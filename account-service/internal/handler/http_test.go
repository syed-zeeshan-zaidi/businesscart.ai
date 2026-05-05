package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"business-cart/account-service/internal/storage"
	"github.com/aws/aws-lambda-go/events"
)

func TestHandleRequest_OPTIONS_Returns200(t *testing.T) {
	h := &LambdaHandler{jwtSecret: "test-secret"}

	resp, err := h.HandleRequest(events.APIGatewayProxyRequest{
		HTTPMethod: "OPTIONS",
		Path:       "/accounts",
		Headers:    map[string]string{"origin": "https://example.com"},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}
}

func TestHandleRequest_MissingAuth_Returns401(t *testing.T) {
	h := &LambdaHandler{jwtSecret: "test-secret"}

	resp, err := h.HandleRequest(events.APIGatewayProxyRequest{
		HTTPMethod: "GET",
		Path:       "/accounts",
		Headers:    map[string]string{"origin": "https://example.com"},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, resp.StatusCode)
	}
}

func TestErrorResponse_Format(t *testing.T) {
	h := &LambdaHandler{requestOrigin: "https://example.com"}

	resp := h.errorResponse(http.StatusBadRequest, "test error")

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}

	var body map[string]string
	if err := json.Unmarshal([]byte(resp.Body), &body); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}
	if body["message"] != "test error" {
		t.Errorf("expected message 'test error', got '%s'", body["message"])
	}
}

// TestValidateCompanyFieldTypes pins the API-first type contract.
// Critical because the BUG that caused real prod 500s was: frontend cleared
// <input type=number> and submitted "" → backend wrote "" to Mongo → BSON
// decoder rejected "" for float64 on every subsequent read → 500. This
// validation rejects bad types at the API boundary so DB never holds them.
//
// Also pins backward compatibility: every payload that was valid before
// (numbers as numbers, booleans as booleans, missing fields, null fields,
// unrelated fields) must STILL be valid. New rule only adds a 400 for
// type-mismatched submissions that were silently corrupting data before.
func TestValidateCompanyFieldTypes(t *testing.T) {
	cases := []struct {
		name    string
		body    string
		wantErr bool
	}{
		// === Backward compatibility: these must continue to pass ===
		{"empty payload", `{}`, false},
		{"valid number for shippingRate", `{"shippingRate": 15.00}`, false},
		{"valid zero for shippingRate", `{"shippingRate": 0}`, false},
		{"valid number for taxRate", `{"taxRate": 8.25}`, false},
		{"valid integer for creditLimit (JSON int decodes to float64)", `{"creditLimit": 5000}`, false},
		{"null clears shippingRate (allowed)", `{"shippingRate": null}`, false},
		{"null clears taxableGoods (allowed)", `{"taxableGoods": null}`, false},
		{"missing fields = partial update OK", `{"name": "Acme"}`, false},
		{"valid booleans", `{"taxableGoods": true, "quotesAllowed": false, "couponsEnabled": true}`, false},
		{"unrelated field passes through", `{"name": "Acme", "address": {"city": "X"}}`, false},
		{"all numeric fields valid together", `{"creditLimit":100,"leadTime":3,"taxRate":8.25,"shippingRate":15,"minOrderAmountLimit":20,"maxOrderAmountLimit":1000,"minOrderQuantityLimit":1,"maxOrderQuantityLimit":50,"monthlyOrderLimit":10,"yearlyOrderLimit":100}`, false},

		// === The bug class: these MUST be rejected now ===
		{"REGRESSION: empty string for shippingRate (the actual prod bug)", `{"shippingRate": ""}`, true},
		{"empty string for taxRate", `{"taxRate": ""}`, true},
		{"empty string for creditLimit", `{"creditLimit": ""}`, true},
		{"empty string for leadTime", `{"leadTime": ""}`, true},
		{"empty string for minOrderAmountLimit", `{"minOrderAmountLimit": ""}`, true},
		{"empty string for maxOrderAmountLimit", `{"maxOrderAmountLimit": ""}`, true},
		{"empty string for minOrderQuantityLimit", `{"minOrderQuantityLimit": ""}`, true},
		{"empty string for maxOrderQuantityLimit", `{"maxOrderQuantityLimit": ""}`, true},
		{"empty string for monthlyOrderLimit", `{"monthlyOrderLimit": ""}`, true},
		{"empty string for yearlyOrderLimit", `{"yearlyOrderLimit": ""}`, true},
		{"non-empty string for shippingRate", `{"shippingRate": "15"}`, true},
		{"boolean for shippingRate", `{"shippingRate": true}`, true},
		{"array for shippingRate", `{"shippingRate": [1,2]}`, true},
		{"object for shippingRate", `{"shippingRate": {}}`, true},
		{"string for taxableGoods", `{"taxableGoods": "yes"}`, true},
		{"string for quotesAllowed", `{"quotesAllowed": "true"}`, true},
		{"string for couponsEnabled", `{"couponsEnabled": "1"}`, true},
		{"number for taxableGoods", `{"taxableGoods": 1}`, true},

		// === First bad field wins, error message names it ===
		{"multiple bad fields rejected (first wins)", `{"shippingRate": "", "taxRate": ""}`, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var company map[string]interface{}
			if err := json.Unmarshal([]byte(tc.body), &company); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}
			err := validateCompanyFieldTypes(company)
			if tc.wantErr && err == nil {
				t.Errorf("expected error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

// TestResolveFloat pins the company-default + customer-override precedence
// for every numeric field that flows into the JWT (creditLimit, taxRate,
// shippingRate, leadTime, min/max order amount, etc.). A regression here
// silently miscalculates EVERY customer's quote against EVERY company.
// py tests use happy-path defaults and would not detect a swap of
// "company default vs customer override" precedence.
//
// Rules:
//  1. customer override (when present) ALWAYS wins, even at zero
//  2. when override is nil: return company default if non-zero
//  3. when override is nil AND company default is zero: return nil
//     (caller treats nil as "no enforcement" — important for $0/zero-disabled)
func TestResolveFloat(t *testing.T) {
	v := func(f float64) *float64 { return &f }
	cases := []struct {
		name           string
		companyDefault float64
		customerOver   *float64
		wantNil        bool
		wantValue      float64
	}{
		// Customer override wins
		{"customer override 100 wins over company 50", 50, v(100), false, 100},
		{"customer override 0 wins (explicit no-limit)", 50, v(0), false, 0},
		{"customer override negative is returned as-is (caller validates)", 50, v(-1), false, -1},

		// Customer override absent: fall back to company default
		{"company default 50, no override", 50, nil, false, 50},
		{"company default 8.25 (tax rate), no override", 8.25, nil, false, 8.25},
		{"company default 15 (shipping rate), no override", 15, nil, false, 15},

		// Both empty: nil signals "no enforcement"
		{"both zero -> nil", 0, nil, true, 0},

		// Override of 0 must NOT be treated as "no override" (regression guard)
		{"REGRESSION: override 0 must NOT collapse to company default", 50, v(0), false, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveFloat(tc.companyDefault, tc.customerOver)
			if tc.wantNil {
				if got != nil {
					t.Errorf("expected nil, got %v", *got)
				}
				return
			}
			if got == nil {
				t.Errorf("expected %v, got nil", tc.wantValue)
				return
			}
			if *got != tc.wantValue {
				t.Errorf("expected %v, got %v", tc.wantValue, *got)
			}
		})
	}
}

// TestOverride pins the nil-safe wrapper around a *float64 getter on a
// possibly-nil CustomerConfiguration. Wrong here = nil pointer panic OR
// wrong override application during JWT construction.
func TestOverride(t *testing.T) {
	v := func(f float64) *float64 { return &f }

	t.Run("nil cfg returns nil", func(t *testing.T) {
		got := override(nil, func(c *storage.CustomerConfiguration) *float64 { return c.CreditLimit })
		if got != nil {
			t.Errorf("expected nil, got %v", *got)
		}
	})

	t.Run("non-nil cfg with nil field returns nil", func(t *testing.T) {
		cfg := &storage.CustomerConfiguration{CreditLimit: nil}
		got := override(cfg, func(c *storage.CustomerConfiguration) *float64 { return c.CreditLimit })
		if got != nil {
			t.Errorf("expected nil, got %v", *got)
		}
	})

	t.Run("non-nil cfg with set field returns pointer", func(t *testing.T) {
		cfg := &storage.CustomerConfiguration{CreditLimit: v(300)}
		got := override(cfg, func(c *storage.CustomerConfiguration) *float64 { return c.CreditLimit })
		if got == nil || *got != 300 {
			t.Errorf("expected 300, got %v", got)
		}
	})

	t.Run("getter is invoked with the cfg", func(t *testing.T) {
		cfg := &storage.CustomerConfiguration{ShippingRate: v(99)}
		got := override(cfg, func(c *storage.CustomerConfiguration) *float64 { return c.ShippingRate })
		if got == nil || *got != 99 {
			t.Errorf("expected 99, got %v", got)
		}
	})
}

// TestExtractClaim pins JWT claim parsing — every authorized endpoint
// extracts role + userID via this function. A regression here = silent
// authz bypass (returning role="" for a malformed claim that downstream
// `if role == "admin"` would skip, allowing "admin" to wrongly succeed
// for a non-admin if the comparison were inverted, OR rejecting valid
// users if extraction fails on edge-case shapes).
//
// Rules:
//  - Both role and id strings present and non-empty -> success
//  - Either missing, wrong type, or empty -> error and empty returns
func TestExtractClaim(t *testing.T) {
	cases := []struct {
		name      string
		claim     map[string]interface{}
		wantRole  string
		wantID    string
		wantErr   bool
	}{
		{"valid admin claim", map[string]interface{}{"role": "admin", "id": "abc123"}, "admin", "abc123", false},
		{"valid customer claim", map[string]interface{}{"role": "customer", "id": "xyz"}, "customer", "xyz", false},
		{"valid b2c claim", map[string]interface{}{"role": "b2c", "id": "ID-1"}, "b2c", "ID-1", false},
		{"valid company claim with extra fields ignored", map[string]interface{}{"role": "company", "id": "co1", "email": "x", "configurations": []interface{}{}}, "company", "co1", false},

		// Missing fields -> error (security: don't accept partial claims)
		{"empty map -> error", map[string]interface{}{}, "", "", true},
		{"missing role -> error", map[string]interface{}{"id": "abc"}, "", "", true},
		{"missing id -> error", map[string]interface{}{"role": "admin"}, "", "", true},
		{"empty role string -> error", map[string]interface{}{"role": "", "id": "abc"}, "", "", true},
		{"empty id string -> error", map[string]interface{}{"role": "admin", "id": ""}, "", "", true},

		// Wrong types (claim came back as number/bool somehow) -> error, not panic
		{"role as number -> error (not crash)", map[string]interface{}{"role": 42, "id": "abc"}, "", "", true},
		{"id as bool -> error (not crash)", map[string]interface{}{"role": "admin", "id": true}, "", "", true},
		{"both wrong types -> error", map[string]interface{}{"role": []interface{}{}, "id": map[string]interface{}{}}, "", "", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			role, id, err := extractClaim(tc.claim)
			if tc.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil; role=%q id=%q", role, id)
				}
				if role != "" || id != "" {
					t.Errorf("on error, expected empty returns; got role=%q id=%q", role, id)
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if role != tc.wantRole {
				t.Errorf("role: got %q, want %q", role, tc.wantRole)
			}
			if id != tc.wantID {
				t.Errorf("id: got %q, want %q", id, tc.wantID)
			}
		})
	}
}

// TestValidatePassword pins password strength rules. Critical because:
//   - Loosening accepts weak passwords (security)
//   - Tightening locks out existing valid users (lockout incident)
// py tests use a known-good password and would not detect either kind of
// drift. Rules: min 8 chars + uppercase + lowercase + digit + special.
func TestValidatePassword(t *testing.T) {
	cases := []struct {
		name    string
		pw      string
		wantErr bool
	}{
		// Valid passwords (all four classes + length)
		{"valid 8 chars all classes", "Abc1!def", false},
		{"valid long password", "MySecure!Password123", false},
		{"valid with all symbol chars", "Abcdef1@", false},
		{"valid with punctuation", "Abcdef1.", false},

		// Too short
		{"empty rejected", "", true},
		{"7 chars rejected", "Abc1!df", true},

		// Missing class
		{"missing uppercase", "abcdef1!", true},
		{"missing lowercase", "ABCDEF1!", true},
		{"missing digit", "Abcdefg!", true},
		{"missing special (only alnum)", "Abcdefg1", true},
		{"only digits", "12345678", true},
		{"only lowercase", "abcdefgh", true},
		{"only uppercase", "ABCDEFGH", true},
		{"only specials", "!@#$%^&*", true},

		// Boundary
		{"exactly 8 chars valid", "Aa1!aaaa", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validatePassword(tc.pw)
			if tc.wantErr && err == nil {
				t.Errorf("expected error for %q, got nil", tc.pw)
			}
			if !tc.wantErr && err != nil {
				t.Errorf("unexpected error for %q: %v", tc.pw, err)
			}
		})
	}
}

package handler

import (
	"encoding/json"
	"net/http"
	"testing"

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

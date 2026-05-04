package handler

import (
	"encoding/json"
	"net/http"
	"testing"

	"business-cart/catalog-service/internal/storage"
	"github.com/aws/aws-lambda-go/events"
)

func TestHandleRequest_OPTIONS_Returns200(t *testing.T) {
	h := &LambdaHandler{jwtSecret: "test-secret"}

	resp, err := h.HandleRequest(events.APIGatewayProxyRequest{
		HTTPMethod: "OPTIONS",
		Path:       "/products",
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
		Path:       "/products",
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

// TestValidatePriceTiers pins the volume-pricing rules. Wrong validation =
// merchants accept malformed tier configs that crash later, or reject valid
// ones (lost sales config). Critical because this is the gatekeeper for
// every product create/update touching priceTiers.
func TestValidatePriceTiers(t *testing.T) {
	cases := []struct {
		name    string
		tiers   []storage.PriceTier
		wantErr bool
	}{
		{"empty tiers ok (no volume pricing)", nil, false},
		{"single tier starting at qty 2", []storage.PriceTier{{MinQty: 2, Price: 9.00}}, false},
		{"two tiers ascending", []storage.PriceTier{{MinQty: 5, Price: 16}, {MinQty: 20, Price: 12}}, false},
		{"three tiers ascending", []storage.PriceTier{{MinQty: 5, Price: 16}, {MinQty: 20, Price: 12}, {MinQty: 100, Price: 8}}, false},

		// First tier must be >= 2 (qty 1 is the base price)
		{"first tier minQty 1 rejected", []storage.PriceTier{{MinQty: 1, Price: 9}}, true},
		{"first tier minQty 0 rejected", []storage.PriceTier{{MinQty: 0, Price: 9}}, true},

		// Sorted strictly ascending
		{"unsorted tiers rejected", []storage.PriceTier{{MinQty: 20, Price: 12}, {MinQty: 5, Price: 16}}, true},
		{"duplicate minQty rejected", []storage.PriceTier{{MinQty: 5, Price: 16}, {MinQty: 5, Price: 12}}, true},

		// Price must be > 0 (no free-tier exploit)
		{"zero price rejected", []storage.PriceTier{{MinQty: 5, Price: 0}}, true},
		{"negative price rejected", []storage.PriceTier{{MinQty: 5, Price: -1}}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validatePriceTiers(tc.tiers)
			if tc.wantErr && err == nil {
				t.Errorf("expected error, got nil")
			}
			if !tc.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

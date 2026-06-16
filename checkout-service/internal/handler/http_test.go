package handler

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/golang-jwt/jwt/v5"
)

// signTestJWT mints a token the handler will accept. Mirrors the auth shape at
// http.go line 154-172: claims["user"] = {"id", "role", ...}.
func signTestJWT(t *testing.T, secret, role string) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user": map[string]interface{}{
			"id":   "test-admin",
			"role": role,
		},
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	s, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign test JWT: %v", err)
	}
	return s
}

func TestHandleRequest_OPTIONS_Returns200(t *testing.T) {
	h := &LambdaHandler{jwtSecret: "test-secret"}

	resp, err := h.HandleRequest(events.APIGatewayProxyRequest{
		HTTPMethod: "OPTIONS",
		Path:       "/checkout/cart",
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
		Path:       "/checkout/cart",
		Headers:    map[string]string{"origin": "https://example.com"},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected status %d, got %d", http.StatusUnauthorized, resp.StatusCode)
	}
}

// TestPutOrder_RejectsDirectRefundedStatus verifies the contract that an admin
// cannot manually set status="refunded" without providing refund details. The
// refund flow must own that status transition (data integrity: refunded status
// implies a refund record exists). Validation runs before any DB lookup, so the
// handler is constructed without an orderService.
func TestPutOrder_RejectsDirectRefundedStatus(t *testing.T) {
	const secret = "test-secret"
	h := &LambdaHandler{jwtSecret: secret}
	token := signTestJWT(t, secret, "admin")

	resp, err := h.HandleRequest(events.APIGatewayProxyRequest{
		HTTPMethod: "PUT",
		// 24-char hex required: validation at line 1153 returns 400 "Invalid order ID" otherwise.
		Path: "/checkout/orders/507f1f77bcf86cd799439011",
		Headers: map[string]string{
			"origin":        "https://example.com",
			"Authorization": "Bearer " + token,
		},
		Body: `{"status":"refunded"}`,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d (body=%s)", http.StatusBadRequest, resp.StatusCode, resp.Body)
	}
	var body map[string]string
	if err := json.Unmarshal([]byte(resp.Body), &body); err != nil {
		t.Fatalf("failed to parse response body: %v", err)
	}
	if msg := body["message"]; msg == "" || !contains(msg, "refundAmount") {
		t.Errorf("expected error message to mention refundAmount, got %q", msg)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
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

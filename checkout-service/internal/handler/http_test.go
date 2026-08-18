package handler

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/golang-jwt/jwt/v5"
	"github.com/syed/businesscart/checkout-service/internal/quote"
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

// ── Order approval chain construction (Roadmap #21) ──────────────────
//
// CreateQuote upserts standard quotes in place, so a buyer who edits the cart
// and checks out again overwrites their own pending-approval quote. buildApprovalChain
// is what guarantees the rebuilt chain is clean. The live proof that this matters
// is Quote.LeadTime: it is assigned by the handler but missing from CreateQuote's
// explicit $set map, so it silently never persists.

func TestBuildApprovalChain_ResetsPriorDecisions(t *testing.T) {
	decidedAt := time.Now()
	// A chain that already carries approvals, as it would after a first submission.
	configured := []quote.ApprovalStep{
		{
			Name:      "Manager",
			Approvers: []quote.Approver{{AccountID: "alice", Email: "alice@test.com"}},
			Status:    quote.ApprovalStepApproved,
			DecidedBy: &quote.Approver{AccountID: "alice"},
			DecidedAt: &decidedAt,
			Note:      "looks fine",
		},
		{
			Name:      "Finance",
			Approvers: []quote.Approver{{AccountID: "bob", Email: "bob@test.com"}},
			Status:    quote.ApprovalStepPending,
		},
	}

	got := buildApprovalChain(configured, quote.ApprovalSideBuyer, "buyer")

	if len(got) != 2 {
		t.Fatalf("expected 2 steps, got %d", len(got))
	}
	for i, step := range got {
		if step.Status != quote.ApprovalStepPending {
			t.Errorf("step %d: status = %q, want %q — a resubmitted cart must re-run the whole chain",
				i, step.Status, quote.ApprovalStepPending)
		}
		if step.DecidedBy != nil || step.DecidedAt != nil || step.Note != "" {
			t.Errorf("step %d: carried a previous decision (by=%v at=%v note=%q); a stale approval would let an unapproved order through",
				i, step.DecidedBy, step.DecidedAt, step.Note)
		}
	}
	// Approvers and labels must survive, or the rebuilt chain is unusable.
	if got[0].Name != "Manager" || got[0].Approvers[0].Email != "alice@test.com" {
		t.Errorf("step 0 lost its configuration: %+v", got[0])
	}
}

func TestBuildApprovalChain_SkipsStepsWithNoApprovers(t *testing.T) {
	// An empty step could never be cleared by anyone and would strand the quote
	// in pending_approval forever.
	got := buildApprovalChain([]quote.ApprovalStep{
		{Name: "Ghost"},
		{Name: "Real", Approvers: []quote.Approver{{AccountID: "alice"}}},
	}, quote.ApprovalSideBuyer, "buyer")
	if len(got) != 1 || got[0].Name != "Real" {
		t.Fatalf("expected only the step with approvers to survive, got %+v", got)
	}
}

func TestBuildApprovalChain_EmptyIsNil(t *testing.T) {
	// nil, not an empty slice: needsApproval keys off len(chain) > 0, and the
	// gate must stay off for every customer with no policy configured.
	if got := buildApprovalChain(nil, quote.ApprovalSideBuyer, "buyer"); got != nil {
		t.Errorf("nil input should give nil chain, got %+v", got)
	}
	if got := buildApprovalChain([]quote.ApprovalStep{{Name: "Ghost"}}, quote.ApprovalSideBuyer, "buyer"); got != nil {
		t.Errorf("a chain of only empty steps should give nil, got %+v", got)
	}
}

func TestBuildApprovalChain_ExcludesTheBuyer(t *testing.T) {
	// A company-wide chain is copied into EVERY customer's JWT at that company,
	// so the named approver is also a buyer. Without excluding them they become
	// their own approver and can sign off on their own spending, which voids the
	// control completely.
	got := buildApprovalChain([]quote.ApprovalStep{
		{Name: "Manager", Approvers: []quote.Approver{
			{AccountID: "alice", Email: "alice@test.com"},
			{AccountID: "bob", Email: "bob@test.com"},
		}},
	}, quote.ApprovalSideBuyer, "alice")

	if len(got) != 1 {
		t.Fatalf("expected the level to survive with its remaining approver, got %+v", got)
	}
	for _, a := range got[0].Approvers {
		if a.AccountID == "alice" {
			t.Fatal("the buyer was left on their own approval step and could self-approve")
		}
	}
	if len(got[0].Approvers) != 1 || got[0].Approvers[0].AccountID != "bob" {
		t.Errorf("expected only bob to remain, got %+v", got[0].Approvers)
	}
}

func TestBuildApprovalChain_BuyerOnlyChainCollapses(t *testing.T) {
	// When the buyer is the ONLY configured approver there is nobody left who
	// could ever clear the step. Collapsing to nil leaves the order ungated
	// rather than stranded forever in pending_approval; the handler logs a
	// warning because it is a misconfiguration.
	if got := buildApprovalChain([]quote.ApprovalStep{
		{Name: "Manager", Approvers: []quote.Approver{{AccountID: "alice", Email: "alice@test.com"}}},
	}, quote.ApprovalSideBuyer, "alice"); got != nil {
		t.Errorf("a buyer-only chain must collapse to nil, got %+v", got)
	}
}

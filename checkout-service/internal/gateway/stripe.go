package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
)

type StripeGateway struct{}

func NewStripeGateway() *StripeGateway {
	return &StripeGateway{}
}

// truncateRunes caps a string at maxRunes characters. Rune-based rather than
// byte-based on purpose: product names carry multi-byte characters (932°F, 23"
// gauntlets), and slicing those mid-rune would hand Stripe invalid UTF-8.
func truncateRunes(s string, maxRunes int) string {
	r := []rune(s)
	if len(r) <= maxRunes {
		return s
	}
	return string(r[:maxRunes])
}

func (g *StripeGateway) ValidateCredentials(credentials map[string]string) error {
	if credentials["secretKey"] == "" {
		return fmt.Errorf("secretKey is required")
	}
	return nil
}

func (g *StripeGateway) CreateSession(ctx context.Context, req SessionRequest) (*SessionResponse, error) {
	secretKey := req.Credentials["secretKey"]

	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("success_url", req.CallbackURL+"?sessionId={CHECKOUT_SESSION_ID}")
	form.Set("cancel_url", req.CallbackURL+"?sessionId={CHECKOUT_SESSION_ID}&cancelled=true")
	form.Set("line_items[0][price_data][currency]", strings.ToLower(req.Currency))
	form.Set("line_items[0][price_data][unit_amount]", fmt.Sprintf("%d", int(math.Round(req.Amount*100))))
	// What the shopper reads on Stripe's hosted page. A bare quote id here reads as
	// an unexplained charge at the exact moment they are deciding to type a card
	// number, so prefer the real product label and fall back to the reference only
	// when the caller supplies nothing. Traceability is unaffected either way:
	// client_reference_id below always carries the quote id.
	lineName := req.Description
	if lineName == "" {
		lineName = "Order " + req.MerchantRef
	}
	form.Set("line_items[0][price_data][product_data][name]", truncateRunes(lineName, 250))
	// Only a well-formed absolute https URL is passed through. Stripe rejects the
	// whole session on a malformed image, and merchant-supplied image fields are
	// not guaranteed clean, so a bad one must never take checkout down with it.
	if u, err := url.Parse(req.ImageURL); err == nil && u.Scheme == "https" && u.Host != "" && len(req.ImageURL) <= 2048 {
		form.Set("line_items[0][price_data][product_data][images][0]", req.ImageURL)
	}
	form.Set("line_items[0][quantity]", "1")
	form.Set("client_reference_id", req.MerchantRef)
	if req.CustomerEmail != "" {
		// Pre-fills the email field on Stripe's hosted Checkout — saves one tap on mobile.
		form.Set("customer_email", req.CustomerEmail)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.stripe.com/v1/checkout/sessions",
		strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	httpReq.SetBasicAuth(secretKey, "")
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("stripe API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("stripe API returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		ID  string `json:"id"`
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse stripe response: %w", err)
	}

	return &SessionResponse{
		ProviderSessionID: result.ID,
		RedirectURL:       result.URL,
	}, nil
}

func (g *StripeGateway) CompleteSession(ctx context.Context, providerSessionID string, _ string, amount float64, currency string, credentials map[string]string, sandbox bool) (*CompletionResponse, error) {
	secretKey := credentials["secretKey"]

	httpReq, err := http.NewRequestWithContext(ctx, "GET",
		"https://api.stripe.com/v1/checkout/sessions/"+providerSessionID, nil)
	if err != nil {
		return nil, err
	}
	httpReq.SetBasicAuth(secretKey, "")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("stripe verify request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("stripe verify returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		ID            string `json:"id"`
		PaymentStatus string `json:"payment_status"`
		PaymentIntent string `json:"payment_intent"`
		Status        string `json:"status"`
		AmountTotal   int    `json:"amount_total"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse stripe session: %w", err)
	}

	expectedCents := int(math.Round(amount * 100))
	if result.AmountTotal != expectedCents {
		return nil, fmt.Errorf("stripe amount mismatch: expected %d cents, got %d", expectedCents, result.AmountTotal)
	}

	status := "failed"
	if result.PaymentStatus == "paid" {
		status = "completed"
	}

	return &CompletionResponse{
		TransactionID: result.PaymentIntent,
		Status:        status,
		ProviderRef:   result.ID,
	}, nil
}

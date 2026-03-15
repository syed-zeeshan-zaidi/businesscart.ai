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
	form.Set("line_items[0][price_data][product_data][name]", "Order "+req.MerchantRef)
	form.Set("line_items[0][quantity]", "1")
	form.Set("client_reference_id", req.MerchantRef)

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

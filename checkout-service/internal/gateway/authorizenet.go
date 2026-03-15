package gateway

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
)

type AuthorizeNetGateway struct{}

func NewAuthorizeNetGateway() *AuthorizeNetGateway {
	return &AuthorizeNetGateway{}
}

func (g *AuthorizeNetGateway) ValidateCredentials(credentials map[string]string) error {
	if credentials["apiLoginId"] == "" {
		return fmt.Errorf("apiLoginId is required")
	}
	if credentials["transactionKey"] == "" {
		return fmt.Errorf("transactionKey is required")
	}
	return nil
}

// stripBOM removes the UTF-8 BOM that Authorize.net includes in JSON responses.
func stripBOM(data []byte) []byte {
	if len(data) >= 3 && data[0] == 0xef && data[1] == 0xbb && data[2] == 0xbf {
		return data[3:]
	}
	return data
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}

func authorizeNetURL(sandbox bool) string {
	if sandbox {
		return "https://apitest.authorize.net/xml/v1/request.api"
	}
	return "https://api.authorize.net/xml/v1/request.api"
}

func authorizeNetAcceptURL(sandbox bool) string {
	if sandbox {
		return "https://test.authorize.net/payment/payment"
	}
	return "https://accept.authorize.net/payment/payment"
}

func (g *AuthorizeNetGateway) CreateSession(ctx context.Context, req SessionRequest) (*SessionResponse, error) {
	apiLoginId := req.Credentials["apiLoginId"]
	transactionKey := req.Credentials["transactionKey"]

	// Generate unique session ID upfront (Authorize.net doesn't provide one)
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	sessionID := "authnet_" + hex.EncodeToString(b)
	invoiceRef := truncate(req.MerchantRef, 20)

	// Create an Accept Hosted payment page via getHostedPaymentPageRequest
	requestBody := map[string]interface{}{
		"getHostedPaymentPageRequest": map[string]interface{}{
			"merchantAuthentication": map[string]string{
				"name":           apiLoginId,
				"transactionKey": transactionKey,
			},
			"transactionRequest": map[string]interface{}{
				"transactionType": "authCaptureTransaction",
				"amount":          fmt.Sprintf("%.2f", req.Amount),
				"order": map[string]string{
					"invoiceNumber": invoiceRef,
				},
			},
			"hostedPaymentSettings": map[string]interface{}{
				"setting": []map[string]interface{}{
					{
						"settingName":  "hostedPaymentReturnOptions",
						"settingValue": fmt.Sprintf(`{"showReceipt":false,"url":"%s?sessionId=%s","urlText":"Continue","cancelUrl":"%s?sessionId=%s&cancelled=true","cancelUrlText":"Cancel"}`, req.CallbackURL, sessionID, req.CallbackURL, sessionID),
					},
					{
						"settingName":  "hostedPaymentButtonOptions",
						"settingValue": `{"text":"Pay"}`,
					},
					{
						"settingName":  "hostedPaymentOrderOptions",
						"settingValue": `{"show":false}`,
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	apiURL := authorizeNetURL(req.Sandbox)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("authorize.net API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Authorize.net returns 200 even for errors — check the response messages
	var result struct {
		Token    string `json:"token"`
		Messages struct {
			ResultCode string `json:"resultCode"`
			Message    []struct {
				Code string `json:"code"`
				Text string `json:"text"`
			} `json:"message"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(stripBOM(body), &result); err != nil {
		return nil, fmt.Errorf("failed to parse authorize.net response: %w", err)
	}

	if result.Messages.ResultCode != "Ok" || result.Token == "" {
		errMsg := "unknown error"
		if len(result.Messages.Message) > 0 {
			errMsg = result.Messages.Message[0].Text
		}
		return nil, fmt.Errorf("authorize.net error: %s", errMsg)
	}

	acceptURL := authorizeNetAcceptURL(req.Sandbox)
	redirectURL := fmt.Sprintf("%s?token=%s", acceptURL, result.Token)

	return &SessionResponse{
		ProviderSessionID: sessionID,
		RedirectURL:       redirectURL,
		InvoiceRef:        invoiceRef,
	}, nil
}

func (g *AuthorizeNetGateway) CompleteSession(ctx context.Context, _ string, invoiceRef string, amount float64, currency string, credentials map[string]string, sandbox bool) (*CompletionResponse, error) {
	apiLoginId := credentials["apiLoginId"]
	transactionKey := credentials["transactionKey"]

	// Fetch recent transactions and find the one matching our reference
	requestBody := map[string]interface{}{
		"getUnsettledTransactionListRequest": map[string]interface{}{
			"merchantAuthentication": map[string]string{
				"name":           apiLoginId,
				"transactionKey": transactionKey,
			},
		},
	}

	bodyBytes, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	apiURL := authorizeNetURL(sandbox)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("authorize.net verify request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Transactions []struct {
			TransID       string  `json:"transId"`
			InvoiceNumber string  `json:"invoiceNumber"`
			Amount        float64 `json:"settleAmount"`
			Status        string  `json:"transactionStatus"`
		} `json:"transactions"`
		Messages struct {
			ResultCode string `json:"resultCode"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(stripBOM(body), &result); err != nil {
		return nil, fmt.Errorf("failed to parse authorize.net transactions: %w", err)
	}

	// Find our transaction by invoice number
	amountCents := int(math.Round(amount * 100))
	for _, tx := range result.Transactions {
		if tx.InvoiceNumber == invoiceRef {
			txAmountCents := int(math.Round(tx.Amount * 100))
			if txAmountCents != amountCents {
				return nil, fmt.Errorf("amount mismatch: expected %.2f, got %.2f", amount, tx.Amount)
			}
			status := "failed"
			if tx.Status == "capturedPendingSettlement" || tx.Status == "settledSuccessfully" {
				status = "completed"
			}
			return &CompletionResponse{
				TransactionID: tx.TransID,
				Status:        status,
				ProviderRef:   tx.TransID,
			}, nil
		}
	}

	return nil, fmt.Errorf("transaction not found for invoice %s", invoiceRef)
}

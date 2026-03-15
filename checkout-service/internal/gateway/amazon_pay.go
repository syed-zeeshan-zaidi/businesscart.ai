package gateway

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

var httpClient = &http.Client{Timeout: 15 * time.Second}

type AmazonPayGateway struct{}

func NewAmazonPayGateway() *AmazonPayGateway {
	return &AmazonPayGateway{}
}

func (g *AmazonPayGateway) ValidateCredentials(credentials map[string]string) error {
	if credentials["merchantId"] == "" {
		return fmt.Errorf("merchantId is required")
	}
	if credentials["storeId"] == "" {
		return fmt.Errorf("storeId is required")
	}
	if credentials["publicKeyId"] == "" {
		return fmt.Errorf("publicKeyId is required")
	}
	if credentials["privateKey"] == "" {
		return fmt.Errorf("privateKey is required")
	}
	if _, err := parsePrivateKey(credentials["privateKey"]); err != nil {
		return fmt.Errorf("invalid privateKey: %w", err)
	}
	return nil
}

func (g *AmazonPayGateway) CreateSession(ctx context.Context, req SessionRequest) (*SessionResponse, error) {
	privateKey, err := parsePrivateKey(req.Credentials["privateKey"])
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	// Generate unique session ID (Amazon creates the checkout session via the button)
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	sessionID := fmt.Sprintf("amzpay_%x", b)

	// Build payload for the Amazon Pay button's createCheckoutSessionConfig
	payload := map[string]interface{}{
		"webCheckoutDetails": map[string]string{
			"checkoutReviewReturnUrl": req.CallbackURL + "?psid=" + sessionID,
		},
		"storeId":              req.Credentials["storeId"],
		"chargePermissionType": "OneTime",
		"paymentDetails": map[string]interface{}{
			"paymentIntent":               "AuthorizeWithCapture",
			"canHandlePendingAuthorization": false,
			"chargeAmount": map[string]string{
				"amount":       fmt.Sprintf("%.2f", req.Amount),
				"currencyCode": req.Currency,
			},
		},
		"merchantMetadata": map[string]string{
			"merchantReferenceId": req.MerchantRef,
		},
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	// Sign the payload using the same pattern as API signing:
	// stringToSign = "AMZN-PAY-RSASSA-PSS-V2\n" + hex(SHA256(payloadJSON))
	// signature = RSA-PSS(SHA256(stringToSign))
	payloadHash := sha256Hex(string(payloadJSON))
	stringToSign := "AMZN-PAY-RSASSA-PSS-V2\n" + payloadHash
	signHash := sha256.Sum256([]byte(stringToSign))
	signature, err := rsa.SignPSS(rand.Reader, privateKey, crypto.SHA256, signHash[:], &rsa.PSSOptions{SaltLength: 32})
	if err != nil {
		return nil, fmt.Errorf("failed to sign payload: %w", err)
	}

	return &SessionResponse{
		ProviderSessionID: sessionID,
		ButtonConfig: map[string]string{
			"merchantId":   req.Credentials["merchantId"],
			"publicKeyId":  req.Credentials["publicKeyId"],
			"payloadJSON":  string(payloadJSON),
			"signature":    base64.StdEncoding.EncodeToString(signature),
			"ledgerCurrency": req.Currency,
			"sandbox":      fmt.Sprintf("%t", req.Sandbox),
		},
	}, nil
}

func (g *AmazonPayGateway) CompleteSession(ctx context.Context, providerSessionID string, _ string, amount float64, currency string, credentials map[string]string, sandbox bool) (*CompletionResponse, error) {
	privateKey, err := parsePrivateKey(credentials["privateKey"])
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	region := credentials["region"]
	if region == "" {
		region = "us"
	}

	body := map[string]interface{}{
		"chargeAmount": map[string]string{
			"amount":       fmt.Sprintf("%.2f", amount),
			"currencyCode": currency,
		},
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	apiURL := amazonPayBaseURL(region)
	path := fmt.Sprintf("/v2/checkoutSessions/%s/complete", providerSessionID)

	headers := buildAmazonHeaders(region, apiURL)
	if sandbox {
		headers["x-amz-pay-sandbox"] = "true"
	}

	authHeader, err := signAmazonRequest("POST", path, "", string(bodyBytes), headers, privateKey, credentials["publicKeyId"])
	if err != nil {
		return nil, fmt.Errorf("failed to sign request: %w", err)
	}
	headers["authorization"] = authHeader

	httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL+path, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		httpReq.Header.Set(k, v)
	}

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("amazon pay complete request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("amazon pay complete returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		CheckoutSessionID  string `json:"checkoutSessionId"`
		ChargeID           string `json:"chargeId"`
		ChargePermissionID string `json:"chargePermissionId"`
		ChargeAmount       struct {
			Amount       string `json:"amount"`
			CurrencyCode string `json:"currencyCode"`
		} `json:"chargeAmount"`
		StatusDetails struct {
			State             string `json:"state"`
			ReasonCode        string `json:"reasonCode"`
			ReasonDescription string `json:"reasonDescription"`
		} `json:"statusDetails"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("failed to parse complete response: %w", err)
	}

	if result.ChargeAmount.Amount != "" {
		expectedAmount := fmt.Sprintf("%.2f", amount)
		if result.ChargeAmount.Amount != expectedAmount {
			return nil, fmt.Errorf("amazon pay amount mismatch: expected %s, got %s", expectedAmount, result.ChargeAmount.Amount)
		}
	}

	status := "failed"
	if result.StatusDetails.State == "Completed" {
		status = "completed"
	}

	return &CompletionResponse{
		TransactionID: result.ChargeID,
		Status:        status,
		ProviderRef:   result.ChargePermissionID,
	}, nil
}

// --- Amazon Pay Request Signing (RSA-PSS, SHA-256, Go stdlib only) ---

func amazonPayRegionCode(region string) string {
	switch region {
	case "eu", "EU":
		return "EU"
	case "jp", "JP":
		return "FE"
	default:
		return "NA"
	}
}

func amazonPayBaseURL(region string) string {
	switch region {
	case "eu", "EU":
		return "https://pay-api.amazon.eu"
	case "jp", "JP":
		return "https://pay-api.amazon.jp"
	default:
		return "https://pay-api.amazon.com"
	}
}

func buildAmazonHeaders(region, apiURL string) map[string]string {
	host := strings.TrimPrefix(apiURL, "https://")
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return map[string]string{
		"accept":                    "application/json",
		"content-type":              "application/json",
		"x-amz-pay-region":         amazonPayRegionCode(region),
		"x-amz-pay-host":           host,
		"x-amz-pay-date":           time.Now().UTC().Format("20060102T150405Z"),
		"x-amz-pay-idempotency-key": fmt.Sprintf("%x", b),
	}
}

func signAmazonRequest(method, path, query, payload string, headers map[string]string, privateKey *rsa.PrivateKey, publicKeyID string) (string, error) {
	// Collect and sort header keys (exclude authorization)
	headerKeys := make([]string, 0, len(headers))
	for k := range headers {
		lk := strings.ToLower(k)
		if lk != "authorization" {
			headerKeys = append(headerKeys, lk)
		}
	}
	sort.Strings(headerKeys)

	// Build lowercase header map for lookup
	headerMap := make(map[string]string, len(headers))
	for k, v := range headers {
		headerMap[strings.ToLower(k)] = v
	}

	// Build canonical headers
	var canonicalHeaders strings.Builder
	for _, k := range headerKeys {
		canonicalHeaders.WriteString(k)
		canonicalHeaders.WriteString(":")
		canonicalHeaders.WriteString(strings.TrimSpace(headerMap[k]))
		canonicalHeaders.WriteString("\n")
	}

	signedHeaders := strings.Join(headerKeys, ";")
	payloadHash := sha256Hex(payload)

	canonicalRequest := strings.Join([]string{
		method,
		path,
		query,
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	stringToSign := "AMZN-PAY-RSASSA-PSS-V2\n" + sha256Hex(canonicalRequest)

	hash := sha256.Sum256([]byte(stringToSign))
	signature, err := rsa.SignPSS(rand.Reader, privateKey, crypto.SHA256, hash[:], &rsa.PSSOptions{SaltLength: 32})
	if err != nil {
		return "", err
	}

	return fmt.Sprintf(
		"AMZN-PAY-RSASSA-PSS-V2 PublicKeyId=%s, SignedHeaders=%s, Signature=%s",
		publicKeyID, signedHeaders, base64.StdEncoding.EncodeToString(signature),
	), nil
}

func sha256Hex(data string) string {
	hash := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", hash)
}

func parsePrivateKey(pemStr string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, fmt.Errorf("failed to parse PEM block")
	}

	// Try PKCS8 first (Amazon Pay typically provides this format)
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err == nil {
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("key is not RSA")
		}
		return rsaKey, nil
	}

	// Fallback to PKCS1
	rsaKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key (tried PKCS8 and PKCS1): %w", err)
	}
	return rsaKey, nil
}

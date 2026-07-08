package conversion

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// GoogleDispatcher ingests conversion events into Google Ads via the Data Manager
// API (POST /v1/events:ingest) — the current, real-time path that replaces the
// legacy uploadClickConversions (blocked for new developer tokens as of
// 2026-06-15). ALL credentials are per-company and arrive decrypted in Send
// (client_id, client_secret, refresh_token, customer_id, conversion_action_id),
// stored encrypted on the account record like Meta's — so Google needs NO
// app-level SSM param or CDK env. stdlib http only, no SDK.
type GoogleDispatcher struct {
	client   *http.Client
	baseURL  string // overridable in tests; defaults to the Data Manager host
	oauthURL string // overridable in tests; defaults to Google's OAuth token host

	mu     sync.Mutex
	tokens map[string]googleToken // refresh_token -> cached access token
}

type googleToken struct {
	accessToken string
	expiresAt   time.Time
}

func NewGoogleDispatcher() *GoogleDispatcher {
	return &GoogleDispatcher{
		client:   &http.Client{Timeout: 4 * time.Second},
		baseURL:  "https://datamanager.googleapis.com",
		oauthURL: "https://oauth2.googleapis.com/token",
		tokens:   map[string]googleToken{},
	}
}

func (g *GoogleDispatcher) Provider() string { return ProviderGoogle }

// accessToken exchanges a refresh token for a short-lived access token, cached
// in-process (keyed by refresh token) until shortly before expiry.
func (g *GoogleDispatcher) accessToken(ctx context.Context, clientID, clientSecret, refreshToken string) (string, error) {
	g.mu.Lock()
	if t, ok := g.tokens[refreshToken]; ok && time.Now().Before(t.expiresAt) {
		tok := t.accessToken
		g.mu.Unlock()
		return tok, nil
	}
	g.mu.Unlock()

	form := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"refresh_token": {refreshToken},
		"grant_type":    {"refresh_token"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.oauthURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := g.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("google oauth %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var tok struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", err
	}
	if tok.AccessToken == "" {
		return "", fmt.Errorf("google oauth: empty access_token")
	}
	ttl := tok.ExpiresIn - 60
	if ttl < 30 {
		ttl = 30
	}
	g.mu.Lock()
	g.tokens[refreshToken] = googleToken{accessToken: tok.AccessToken, expiresAt: time.Now().Add(time.Duration(ttl) * time.Second)}
	g.mu.Unlock()
	return tok.AccessToken, nil
}

// Send ingests one conversion event. Requires a gclid (only Google-attributable
// clicks upload) plus the per-company creds. Returns the gclid as the provider
// ref and the number of match signals (gclid + hashed identifiers) as the EMQ
// proxy.
func (g *GoogleDispatcher) Send(ctx context.Context, ev Event, creds map[string]string) (SendResult, error) {
	clientID := creds["client_id"]
	clientSecret := creds["client_secret"]
	refreshTok := creds["refresh_token"]
	customerID := googleDigits(creds["customer_id"])
	if clientID == "" || clientSecret == "" || refreshTok == "" || customerID == "" {
		return SendResult{}, fmt.Errorf("google: missing client_id/client_secret/refresh_token/customer_id")
	}
	if ev.Gclid == "" {
		return SendResult{Skipped: true}, nil // not a Google-attributable click: skip, not a failure
	}
	// Route to the per-event conversion action (so the seller can set Purchase as a
	// PRIMARY/bidding action and ViewContent/AddToCart as SECONDARY/observation, per
	// Google's guidance) or the generic one. No action mapped for this event → skip.
	actionID := googleActionID(creds, ev.EventName)
	if actionID == "" {
		return SendResult{Skipped: true}, nil
	}
	loginID := googleDigits(creds["login_customer_id"])
	if loginID == "" {
		loginID = customerID
	}

	access, err := g.accessToken(ctx, clientID, clientSecret, refreshTok)
	if err != nil {
		return SendResult{}, err
	}

	// Payload shape verified 2026-07-06 against the official Data Manager API
	// spec: developers.google.com/data-manager/api/devguides/events/send-events
	// and .../reference/rest/v1/events/ingest. Confirmed: top-level `encoding`
	// (HEX|BASE64); operating/loginAccount accountType "GOOGLE_ADS"; eventSource
	// enum WEB|APP|IN_STORE|PHONE|OTHER, and for online events it MUST be "WEB";
	// eventTimestamp is RFC3339; userIdentifiers use hashed emailAddress/phoneNumber;
	// productDestinationId is a conversion action of type WEBPAGE. Field names and
	// nesting below match the documented example exactly.
	event := map[string]interface{}{
		"eventTimestamp": ev.EventTime.Format(time.RFC3339),
		"eventSource":    "WEB",
		"adIdentifiers":  map[string]interface{}{"gclid": ev.Gclid},
	}
	if ev.EventID != "" {
		event["transactionId"] = ev.EventID // dedup
	}
	if ev.Value > 0 {
		event["conversionValue"] = ev.Value
		event["currency"] = strings.ToUpper(defaultCurrency(ev.Currency))
	}
	// Enhanced conversions: hashed identifiers (SHA-256 hex; declared by encoding:HEX).
	var ids []map[string]interface{}
	if h := hashNormalized(ev.Email); h != "" {
		ids = append(ids, map[string]interface{}{"emailAddress": h})
	}
	if h := hashPhone(ev.Phone); h != "" {
		ids = append(ids, map[string]interface{}{"phoneNumber": h})
	}
	if len(ids) > 0 {
		event["userData"] = map[string]interface{}{"userIdentifiers": ids}
	}

	payload := map[string]interface{}{
		"destinations": []interface{}{map[string]interface{}{
			"operatingAccount":     map[string]interface{}{"accountType": "GOOGLE_ADS", "accountId": customerID},
			"loginAccount":         map[string]interface{}{"accountType": "GOOGLE_ADS", "accountId": loginID},
			"productDestinationId": actionID,
		}},
		"encoding":     "HEX",
		"events":       []interface{}{event},
		"validateOnly": false,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return SendResult{}, err
	}

	reqURL := g.baseURL + "/v1/events:ingest"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(body))
	if err != nil {
		return SendResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+access)
	resp, err := g.client.Do(req)
	if err != nil {
		return SendResult{}, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return SendResult{}, fmt.Errorf("google data manager %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return SendResult{ProviderRef: ev.Gclid, MatchFields: 1 + len(ids)}, nil
}

// googleActionID resolves the Data Manager conversion action (productDestinationId)
// for an event. The generic `conversion_action_id` is the PURCHASE/PRIMARY action:
// only Purchase falls back to it. Micro-events (ViewContent/AddToCart/Checkout) are
// SECONDARY/observation and send ONLY when the seller explicitly maps them to their
// own action — otherwise they return "" and the caller skips. This keeps a
// default-only seller sending purchases alone (a clean bidding signal) instead of
// dumping every event into one action. Google routes by conversion action, not
// event name, so this mapping must happen here.
func googleActionID(creds map[string]string, eventName string) string {
	switch eventName {
	case "Purchase":
		return creds["conversion_action_id"] // the primary/purchase action
	case "ViewContent":
		return creds["conversion_action_id_viewcontent"]
	case "AddToCart":
		return creds["conversion_action_id_addtocart"]
	case "InitiateCheckout":
		return creds["conversion_action_id_initiatecheckout"]
	}
	return ""
}

// googleDigits strips non-digits from a customer id ("123-456-7890" -> "1234567890").
func googleDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

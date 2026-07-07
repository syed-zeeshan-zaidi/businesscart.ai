package conversion

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestGoogleSendIngestPayload(t *testing.T) {
	var ingestBody map[string]interface{}
	var authHeader, contentType string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			io.WriteString(w, `{"access_token":"ya29.test","expires_in":3600}`)
		case "/v1/events:ingest":
			authHeader = r.Header.Get("Authorization")
			contentType = r.Header.Get("Content-Type")
			b, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(b, &ingestBody)
			io.WriteString(w, `{}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	d := &GoogleDispatcher{client: srv.Client(), baseURL: srv.URL, oauthURL: srv.URL + "/token", tokens: map[string]googleToken{}}
	ev := Event{
		EventName: "Purchase",
		EventID:   "order123",
		EventTime: time.Now(),
		Value:     49.99,
		Currency:  "usd",
		Email:     "Buyer@Example.com ",
		Gclid:     "GCL_ABC",
	}
	creds := map[string]string{
		"client_id": "cid", "client_secret": "csec", "refresh_token": "rt",
		"customer_id": "123-456-7890", "conversion_action_id": "555",
	}
	res, err := d.Send(context.Background(), ev, creds)
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if res.ProviderRef != "GCL_ABC" {
		t.Errorf("ProviderRef = %q, want the gclid", res.ProviderRef)
	}
	if res.MatchFields != 2 { // gclid + hashed email
		t.Errorf("MatchFields = %d, want 2", res.MatchFields)
	}
	if !strings.HasPrefix(authHeader, "Bearer ya29.test") {
		t.Errorf("Authorization = %q, want the exchanged access token", authHeader)
	}
	if contentType != "application/json" {
		t.Errorf("Content-Type = %q", contentType)
	}

	dests := ingestBody["destinations"].([]interface{})
	d0 := dests[0].(map[string]interface{})
	op := d0["operatingAccount"].(map[string]interface{})
	if op["accountId"] != "1234567890" {
		t.Errorf("operating accountId = %v, want digits-only", op["accountId"])
	}
	if op["accountType"] != "GOOGLE_ADS" {
		t.Errorf("accountType = %v", op["accountType"])
	}
	if d0["productDestinationId"] != "555" {
		t.Errorf("productDestinationId = %v", d0["productDestinationId"])
	}

	events := ingestBody["events"].([]interface{})
	e0 := events[0].(map[string]interface{})
	if e0["adIdentifiers"].(map[string]interface{})["gclid"] != "GCL_ABC" {
		t.Errorf("gclid = %v", e0["adIdentifiers"])
	}
	if e0["transactionId"] != "order123" {
		t.Errorf("transactionId = %v, want dedup id", e0["transactionId"])
	}
	if e0["conversionValue"].(float64) != 49.99 {
		t.Errorf("conversionValue = %v", e0["conversionValue"])
	}
	if e0["currency"] != "USD" {
		t.Errorf("currency = %v, want upper-cased", e0["currency"])
	}
	// enhanced conversions: email must be a 64-char hex hash, never plaintext
	ud := e0["userData"].(map[string]interface{})
	em := ud["userIdentifiers"].([]interface{})[0].(map[string]interface{})["emailAddress"].(string)
	if strings.Contains(em, "@") || len(em) != 64 {
		t.Errorf("email not SHA-256-hex hashed: %q", em)
	}
	if ingestBody["encoding"] != "HEX" {
		t.Errorf("encoding = %v, want HEX", ingestBody["encoding"])
	}
}

// TestGoogleSendSkipsWithoutGclid: only Google-attributable clicks upload. A
// missing gclid is a deliberate no-op (Skipped), NOT a failure — otherwise
// ordinary organic traffic would inflate the "conversions failed" analytics.
func TestGoogleSendSkipsWithoutGclid(t *testing.T) {
	d := NewGoogleDispatcher()
	res, err := d.Send(context.Background(), Event{EventName: "Purchase"}, map[string]string{
		"client_id": "c", "client_secret": "s", "refresh_token": "r", "customer_id": "1", "conversion_action_id": "2",
	})
	if err != nil {
		t.Errorf("no-gclid must not error, got %v", err)
	}
	if !res.Skipped {
		t.Error("no-gclid must return Skipped=true (not a failure)")
	}
}

func TestGoogleSendMissingCreds(t *testing.T) {
	d := NewGoogleDispatcher()
	if _, err := d.Send(context.Background(), Event{Gclid: "g"}, map[string]string{"client_id": "c"}); err == nil {
		t.Error("expected error when required creds incomplete")
	}
}

func TestGoogleDigits(t *testing.T) {
	if got := googleDigits("123-456-7890"); got != "1234567890" {
		t.Errorf("googleDigits = %q", got)
	}
}

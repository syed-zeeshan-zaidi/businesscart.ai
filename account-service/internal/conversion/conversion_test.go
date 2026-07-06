package conversion

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestParseKey(t *testing.T) {
	valid := base64.StdEncoding.EncodeToString(make([]byte, 32))
	if k, err := ParseKey(valid); err != nil || len(k) != 32 {
		t.Errorf("valid 32-byte key: len=%d err=%v", len(k), err)
	}
	if _, err := ParseKey("!!!not-base64"); err == nil {
		t.Error("invalid base64 must error")
	}
	if _, err := ParseKey(base64.StdEncoding.EncodeToString(make([]byte, 16))); err == nil {
		t.Error("wrong-length (16-byte) key must error")
	}
}

func sha256hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func TestHashNormalized(t *testing.T) {
	got := hashNormalized("  Test@Example.COM ")
	want := sha256hex("test@example.com")
	if got != want {
		t.Errorf("hashNormalized = %s, want %s", got, want)
	}
	if hashNormalized("   ") != "" {
		t.Error("blank input must hash to empty string, not a hash of whitespace")
	}
}

func TestHashPhone(t *testing.T) {
	got := hashPhone("+1 (415) 555-1234")
	want := sha256hex("14155551234")
	if got != want {
		t.Errorf("hashPhone = %s, want %s", got, want)
	}
}

func TestBuildFbc(t *testing.T) {
	tm := time.Unix(1700000000, 0)
	got := buildFbc("abc123", tm)
	want := fmt.Sprintf("fb.1.%d.abc123", tm.UnixMilli())
	if got != want {
		t.Errorf("buildFbc = %s, want %s", got, want)
	}
	if buildFbc("", tm) != "" {
		t.Error("empty fbclid must yield empty fbc")
	}
}

// TestCryptoRoundTrip verifies encrypt/decrypt with a JWT-derived key.
func TestCryptoRoundTrip(t *testing.T) {
	key := DeriveKey("some-jwt-secret")
	enc, err := Encrypt(key, "EAAtoken-secret")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	dec, err := Decrypt(key, enc)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if dec != "EAAtoken-secret" {
		t.Errorf("roundtrip = %s, want EAAtoken-secret", dec)
	}
}

// TestMetaSendPurchasePayload asserts the CAPI request body carries the dedup
// event_id, hashed email, raw ip/ua, and matching content_ids.
func TestMetaSendPurchasePayload(t *testing.T) {
	var captured map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"events_received":1,"fbtrace_id":"trace123"}`))
	}))
	defer srv.Close()

	d := &MetaDispatcher{client: srv.Client(), baseURL: srv.URL}
	ev := Event{
		EventName:  "Purchase",
		EventID:    "order777",
		EventTime:  time.Unix(1700000000, 0),
		Value:      69.99,
		Currency:   "USD",
		Email:      "Buyer@Example.com",
		ExternalID: "v_abc",
		ClientIP:   "1.2.3.4",
		ClientUA:   "Mozilla/5.0",
		Fbclid:     "fbclid123",
		Contents:   []Content{{ProductID: "prod1", Quantity: 2, ItemPrice: 34.99}},
	}
	res, err := d.Send(context.Background(), ev, map[string]string{"pixel_id": "PIX", "access_token": "TOK"})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if res.ProviderRef != "trace123" {
		t.Errorf("providerRef = %s, want trace123", res.ProviderRef)
	}
	if res.MatchFields == 0 {
		t.Error("expected non-zero match fields")
	}

	data := captured["data"].([]interface{})
	event := data[0].(map[string]interface{})
	if event["event_id"] != "order777" {
		t.Errorf("event_id = %v, want order777 (dedup key)", event["event_id"])
	}
	if event["action_source"] != "website" {
		t.Errorf("action_source = %v, want website", event["action_source"])
	}
	ud := event["user_data"].(map[string]interface{})
	if em := ud["em"].([]interface{}); em[0] != sha256hex("buyer@example.com") {
		t.Errorf("em not correctly hashed/normalized: %v", em[0])
	}
	if ud["client_ip_address"] != "1.2.3.4" {
		t.Errorf("client_ip_address = %v, want raw 1.2.3.4", ud["client_ip_address"])
	}
	cd := event["custom_data"].(map[string]interface{})
	if cd["order_id"] != "order777" {
		t.Errorf("custom_data.order_id = %v", cd["order_id"])
	}
	ids := cd["content_ids"].([]interface{})
	if len(ids) != 1 || ids[0] != "prod1" {
		t.Errorf("content_ids = %v, want [prod1]", ids)
	}
}

func TestMetaMissingCreds(t *testing.T) {
	d := NewMetaDispatcher()
	if _, err := d.Send(context.Background(), Event{EventName: "Purchase"}, map[string]string{}); err == nil {
		t.Error("expected error when pixel_id/access_token missing")
	}
}

func TestDecryptWrongKey(t *testing.T) {
	enc, err := Encrypt(DeriveKey("keyA"), "secret-token")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if _, err := Decrypt(DeriveKey("keyB"), enc); err == nil {
		t.Error("decrypt with the wrong key must fail")
	}
}

// TestMetaSendEventName confirms the event_name passes through (ViewContent)
// and that content_ids carry the product id for catalog matching.
func TestMetaSendEventName(t *testing.T) {
	var captured map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured)
		_, _ = w.Write([]byte(`{"fbtrace_id":"t"}`))
	}))
	defer srv.Close()

	d := &MetaDispatcher{client: srv.Client(), baseURL: srv.URL}
	ev := Event{
		EventName: "ViewContent",
		EventID:   "v_1:vc:prod9",
		EventTime: time.Unix(1700000000, 0),
		Value:     19.99,
		Currency:  "USD",
		Contents:  []Content{{ProductID: "prod9", Quantity: 1, ItemPrice: 19.99}},
	}
	if _, err := d.Send(context.Background(), ev, map[string]string{"pixel_id": "P", "access_token": "T"}); err != nil {
		t.Fatalf("send: %v", err)
	}
	event := captured["data"].([]interface{})[0].(map[string]interface{})
	if event["event_name"] != "ViewContent" {
		t.Errorf("event_name = %v, want ViewContent", event["event_name"])
	}
	cd := event["custom_data"].(map[string]interface{})
	if ids := cd["content_ids"].([]interface{}); ids[0] != "prod9" {
		t.Errorf("content_ids = %v, want [prod9]", ids)
	}
}

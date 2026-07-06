package handler

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"business-cart/account-service/internal/conversion"
	"business-cart/account-service/internal/storage"
)

// TestNewLambdaHandlerConversionKeyGating verifies conversions are enabled only
// with a valid dedicated key, and disabled (no JWT fallback) otherwise.
func TestNewLambdaHandlerConversionKeyGating(t *testing.T) {
	// no key -> disabled
	h := NewLambdaHandler(nil, "jwt", "refresh", "", "", "", nil)
	if h.conversions != nil || h.convKey != nil {
		t.Error("empty CONVERSION_ENCRYPTION_KEY must disable conversions")
	}
	// malformed key -> disabled
	h = NewLambdaHandler(nil, "jwt", "refresh", "", "", "!!!invalid", nil)
	if h.conversions != nil || h.convKey != nil {
		t.Error("invalid key must disable conversions")
	}
	// valid 32-byte key -> enabled
	key := base64.StdEncoding.EncodeToString(make([]byte, 32))
	h = NewLambdaHandler(nil, "jwt", "refresh", "", "", key, nil)
	if h.conversions == nil || len(h.convKey) != 32 {
		t.Error("valid key must enable conversions")
	}
}

func TestMetaFloat(t *testing.T) {
	cases := []struct {
		in   interface{}
		want float64
	}{
		{float64(3.5), 3.5}, // JSON numbers always arrive as float64
		{"nope", 0},
		{nil, 0},
	}
	for _, c := range cases {
		if got := metaFloat(c.in); got != c.want {
			t.Errorf("metaFloat(%v) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestParseConversionContents(t *testing.T) {
	in := []interface{}{
		map[string]interface{}{"id": "p1", "quantity": float64(2), "price": float64(9.99)},
		map[string]interface{}{"productId": "p2", "price": float64(5)}, // no qty -> 1; id via productId
		map[string]interface{}{"quantity": float64(1)},                 // no id -> skipped
	}
	got := parseConversionContents(in)
	if len(got) != 2 {
		t.Fatalf("len = %d, want 2 (item without id skipped)", len(got))
	}
	if got[0].ProductID != "p1" || got[0].Quantity != 2 || got[0].ItemPrice != 9.99 {
		t.Errorf("item0 = %+v", got[0])
	}
	if got[1].ProductID != "p2" || got[1].Quantity != 1 {
		t.Errorf("item1 = %+v (quantity should default to 1)", got[1])
	}
	if parseConversionContents("not-an-array") != nil {
		t.Error("non-array input must yield nil")
	}
}

// TestBuildAdConversionsInfoMasksToken proves the display view exposes the
// pixel id + token last-4 but NEVER the full access token.
func TestBuildAdConversionsInfoMasksToken(t *testing.T) {
	key := conversion.DeriveKey("testsecret")
	h := &LambdaHandler{convKey: key}
	encPixel, _ := conversion.Encrypt(key, "27127909456873876")
	fullToken := "EAAsupersecrettoken1234"
	encTok, _ := conversion.Encrypt(key, fullToken)

	acc := &storage.Account{
		AdConversions:        map[string]map[string]string{"meta": {"pixel_id": encPixel, "access_token": encTok}},
		AdConversionsEnabled: map[string]bool{"meta": true},
	}
	h.buildAdConversionsInfo(acc)

	info, ok := acc.AdConversionsInfo["meta"]
	if !ok || !info.Configured || !info.Enabled {
		t.Fatalf("expected configured+enabled meta info, got %+v", acc.AdConversionsInfo)
	}
	if info.PixelID != "27127909456873876" {
		t.Errorf("pixelId = %q, want the full pixel id", info.PixelID)
	}
	if info.TokenLast4 != "1234" {
		t.Errorf("tokenLast4 = %q, want 1234", info.TokenLast4)
	}
	// The full token must not appear anywhere in the serialized display view.
	b, _ := json.Marshal(acc.AdConversionsInfo)
	if strings.Contains(string(b), fullToken) {
		t.Fatal("SECURITY: full access token leaked into adConversionsInfo")
	}
}

// TestBuildAdConversionSetFieldsPartialUpdate is the regression guard for the
// data-loss bug: rotating only the access_token must NOT wipe the stored
// pixel_id. The fix writes each credential to its own dotted path so Mongo
// merges the sub-document; a whole-map $set on "adConversions.meta" would drop
// pixel_id. We assert the emitted $set keys are per-field, that the untouched
// pixel_id has no $set entry (so it survives), and that the new token decrypts.
func TestBuildAdConversionSetFieldsPartialUpdate(t *testing.T) {
	key := conversion.DeriveKey("testsecret")
	h := &LambdaHandler{convKey: key}

	// Client resends only the access_token (pixel_id already configured, left blank).
	newToken := "EAArotatedtoken9999"
	fields, err := h.buildAdConversionSetFields(map[string]map[string]string{
		"meta": {"access_token": newToken, "pixel_id": "  "}, // blank pixel_id must be skipped
	})
	if err != nil {
		t.Fatalf("buildAdConversionSetFields: %v", err)
	}

	// A whole-map replacement would produce this key; it must NOT be present.
	if _, bad := fields["adConversions.meta"]; bad {
		t.Fatal("whole-map $set on adConversions.meta would wipe sibling fields")
	}
	// The blank pixel_id must not be written, so Mongo leaves the stored one intact.
	if _, present := fields["adConversions.meta.pixel_id"]; present {
		t.Error("blank pixel_id must be skipped, not written")
	}
	if len(fields) != 1 {
		t.Fatalf("expected exactly 1 $set entry (access_token), got %d: %v", len(fields), fields)
	}

	enc, ok := fields["adConversions.meta.access_token"].(string)
	if !ok {
		t.Fatal("access_token must be set at its per-field dotted path")
	}
	got, derr := conversion.Decrypt(key, enc)
	if derr != nil || got != newToken {
		t.Errorf("decrypt = %q (err %v), want %q", got, derr, newToken)
	}
}

// TestBuildAdConversionSetFieldsRejectsUnknownProvider proves an unknown
// provider's credentials are never persisted (only registered dispatchers pass).
func TestBuildAdConversionSetFieldsRejectsUnknownProvider(t *testing.T) {
	h := &LambdaHandler{convKey: conversion.DeriveKey("testsecret")}
	fields, err := h.buildAdConversionSetFields(map[string]map[string]string{
		"meta":  {"access_token": "good"},
		"bogus": {"access_token": "junk"}, // unregistered provider -> dropped
	})
	if err != nil {
		t.Fatalf("buildAdConversionSetFields: %v", err)
	}
	if _, ok := fields["adConversions.bogus.access_token"]; ok {
		t.Error("unknown provider must not be persisted")
	}
	if _, ok := fields["adConversions.meta.access_token"]; !ok {
		t.Error("known provider (meta) must be persisted")
	}
}

func TestBuildAdConversionsInfoEmpty(t *testing.T) {
	h := &LambdaHandler{convKey: conversion.DeriveKey("x")}
	acc := &storage.Account{}
	h.buildAdConversionsInfo(acc)
	if acc.AdConversionsInfo != nil {
		t.Error("no creds -> AdConversionsInfo should stay nil")
	}
}

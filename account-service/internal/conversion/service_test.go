package conversion

import (
	"context"
	"errors"
	"testing"
)

type fakeDispatcher struct {
	provider string
	gotCreds map[string]string
	gotEvent Event
	ret      SendResult
	err      error
	called   int
}

func (f *fakeDispatcher) Provider() string { return f.provider }
func (f *fakeDispatcher) Send(_ context.Context, ev Event, creds map[string]string) (SendResult, error) {
	f.called++
	f.gotCreds = creds
	f.gotEvent = ev
	return f.ret, f.err
}

func TestServiceSendDecryptsAndDispatches(t *testing.T) {
	key := DeriveKey("secret")
	fd := &fakeDispatcher{provider: "meta", ret: SendResult{ProviderRef: "r1", MatchFields: 4}}
	reg := NewRegistry()
	reg.Register(fd)
	svc := NewService(reg, key)

	encPixel, _ := Encrypt(key, "PIX")
	encTok, _ := Encrypt(key, "TOK")
	enc := map[string]map[string]string{"meta": {"pixel_id": encPixel, "access_token": encTok}}

	results := svc.Send(Event{EventName: "Purchase", EventID: "o1"}, enc)
	if fd.called != 1 {
		t.Fatalf("dispatcher called %d times, want 1", fd.called)
	}
	// Creds must be decrypted before reaching the dispatcher.
	if fd.gotCreds["pixel_id"] != "PIX" || fd.gotCreds["access_token"] != "TOK" {
		t.Errorf("dispatcher got creds %v, want decrypted", fd.gotCreds)
	}
	if len(results) != 1 || results[0].Status != "sent" || results[0].ProviderRef != "r1" || results[0].MatchFields != 4 {
		t.Errorf("results = %+v", results)
	}
}

func TestServiceSendDecryptFailure(t *testing.T) {
	key := DeriveKey("secret")
	fd := &fakeDispatcher{provider: "meta"}
	reg := NewRegistry()
	reg.Register(fd)
	svc := NewService(reg, key)

	enc := map[string]map[string]string{"meta": {"access_token": "!!!not-valid-base64"}}
	results := svc.Send(Event{EventName: "Purchase"}, enc)
	if fd.called != 0 {
		t.Error("dispatcher must not be called when decrypt fails")
	}
	if len(results) != 1 || results[0].Status != "failed" || results[0].Error != "decrypt" {
		t.Errorf("results = %+v, want one failed/decrypt", results)
	}
}

func TestServiceSendUnregisteredProviderSkipped(t *testing.T) {
	key := DeriveKey("secret")
	svc := NewService(NewRegistry(), key) // nothing registered
	encTok, _ := Encrypt(key, "TOK")
	results := svc.Send(Event{EventName: "Purchase"}, map[string]map[string]string{"meta": {"access_token": encTok}})
	if results != nil {
		t.Errorf("unregistered provider must yield no results, got %+v", results)
	}
}

func TestServiceSendDispatcherError(t *testing.T) {
	key := DeriveKey("secret")
	fd := &fakeDispatcher{provider: "meta", err: errors.New("boom")}
	reg := NewRegistry()
	reg.Register(fd)
	svc := NewService(reg, key)
	encTok, _ := Encrypt(key, "TOK")
	results := svc.Send(Event{EventName: "Purchase"}, map[string]map[string]string{"meta": {"access_token": encTok}})
	if len(results) != 1 || results[0].Status != "failed" || results[0].Error != "boom" {
		t.Errorf("results = %+v, want failed/boom", results)
	}
}

func TestServiceSendSkippedYieldsNoResult(t *testing.T) {
	key := DeriveKey("secret")
	fd := &fakeDispatcher{provider: "google", ret: SendResult{Skipped: true}}
	reg := NewRegistry()
	reg.Register(fd)
	svc := NewService(reg, key)
	encTok, _ := Encrypt(key, "TOK")
	results := svc.Send(Event{EventName: "Purchase"}, map[string]map[string]string{"google": {"refresh_token": encTok}})
	if results != nil {
		t.Errorf("skipped dispatch must yield no result (not a failure), got %+v", results)
	}
}

func TestServiceSendEmptyIsNil(t *testing.T) {
	svc := NewService(NewRegistry(), DeriveKey("secret"))
	if r := svc.Send(Event{EventName: "Purchase"}, nil); r != nil {
		t.Errorf("empty creds must yield nil, got %+v", r)
	}
}

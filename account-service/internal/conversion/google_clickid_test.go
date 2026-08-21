package conversion

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// newCapturingGoogle returns a dispatcher pointed at a stub Data Manager, plus a
// pointer to the decoded ingest body so a test can assert what was actually sent.
func newCapturingGoogle(t *testing.T) (*GoogleDispatcher, *map[string]interface{}) {
	t.Helper()
	body := map[string]interface{}{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			io.WriteString(w, `{"access_token":"ya29.test","expires_in":3600}`)
		case "/v1/events:ingest":
			b, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(b, &body)
			io.WriteString(w, `{}`)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	d := &GoogleDispatcher{client: srv.Client(), baseURL: srv.URL, oauthURL: srv.URL + "/token", tokens: map[string]googleToken{}}
	return d, &body
}

func googleTestCreds() map[string]string {
	return map[string]string{
		"client_id": "cid", "client_secret": "csec", "refresh_token": "rt",
		"customer_id": "123-456-7890", "conversion_action_id": "555",
	}
}

func adIdentifiersOf(t *testing.T, body map[string]interface{}) map[string]interface{} {
	t.Helper()
	events, ok := body["events"].([]interface{})
	if !ok || len(events) == 0 {
		t.Fatalf("no events in payload: %#v", body)
	}
	ids, ok := events[0].(map[string]interface{})["adIdentifiers"].(map[string]interface{})
	if !ok {
		t.Fatalf("no adIdentifiers in event: %#v", events[0])
	}
	return ids
}

// gbraid and wbraid are Google click identifiers too. Google sets them instead of
// a gclid on iOS journeys, where Apple's rules prevent one. Requiring a gclid
// silently dropped 10 of 45 attributable events on uSetGo between 2026-07-29 and
// 2026-08-20, two of them purchases, while Meta reported normally throughout.
func TestGoogleSendUsesGbraidAndWbraid(t *testing.T) {
	cases := []struct {
		name    string
		ev      Event
		wantKey string
		wantVal string
	}{
		{"gclid only", Event{Gclid: "GCL_1"}, "gclid", "GCL_1"},
		{"gbraid only", Event{Gbraid: "GB_1"}, "gbraid", "GB_1"},
		{"wbraid only", Event{Wbraid: "WB_1"}, "wbraid", "WB_1"},
		// Preference order. Every event that succeeds today carries a gclid, so
		// preferring it means this change cannot alter any currently-working
		// conversion. It only affects events that were previously skipped.
		{"gclid wins over gbraid", Event{Gclid: "GCL_2", Gbraid: "GB_2"}, "gclid", "GCL_2"},
		{"gbraid wins over wbraid", Event{Gbraid: "GB_3", Wbraid: "WB_3"}, "gbraid", "GB_3"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			d, body := newCapturingGoogle(t)
			ev := tc.ev
			ev.EventName = "Purchase"
			ev.EventTime = time.Now()
			res, err := d.Send(context.Background(), ev, googleTestCreds())
			if err != nil {
				t.Fatalf("Send: %v", err)
			}
			if res.Skipped {
				t.Fatal("event carrying a Google click id must not be skipped")
			}
			ids := adIdentifiersOf(t, *body)

			if ids[tc.wantKey] != tc.wantVal {
				t.Errorf("adIdentifiers[%q] = %v, want %q", tc.wantKey, ids[tc.wantKey], tc.wantVal)
			}
			// Exactly ONE identifier. Google only began accepting gclid+gbraid
			// together in late 2025, and an unexpected combination risks the whole
			// event being rejected.
			if len(ids) != 1 {
				t.Errorf("expected exactly 1 ad identifier, got %d: %#v", len(ids), ids)
			}
			if res.ProviderRef != tc.wantVal {
				t.Errorf("ProviderRef = %q, want %q (the identifier actually sent)", res.ProviderRef, tc.wantVal)
			}
		})
	}
}

// With no Google click identifier of any kind there is genuinely nothing to
// attribute, so this stays a silent no-op rather than a failure: organic traffic
// must not inflate the "conversions failed" count.
func TestGoogleSendSkipsWithNoClickIdentifierAtAll(t *testing.T) {
	d, _ := newCapturingGoogle(t)
	res, err := d.Send(context.Background(), Event{EventName: "Purchase", EventTime: time.Now()}, googleTestCreds())
	if err != nil {
		t.Errorf("must not error, got %v", err)
	}
	if !res.Skipped {
		t.Error("no click identifier of any kind must return Skipped=true")
	}
}

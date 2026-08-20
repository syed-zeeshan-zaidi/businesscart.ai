package handler

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"business-cart/catalog-service/internal/storage"
)

func TestNormalizeFAQ_MapPath(t *testing.T) {
	faq := map[string]interface{}{
		// Count is a lie the client sent. It must be recomputed, never trusted,
		// same contract as recomputeRating.
		"count": 99,
		"items": []interface{}{
			map[string]interface{}{"question": "  Rated to 900F?  ", "answer": "  Yes.  "},
			map[string]interface{}{"question": "No answer", "answer": "   "}, // dropped
			map[string]interface{}{"question": "", "answer": "No question"},  // dropped
			"not a map", // dropped
		},
	}
	out := normalizeFAQ(faq)

	items, _ := out["items"].([]interface{})
	if len(items) != 1 {
		t.Fatalf("expected 1 surviving item, got %d", len(items))
	}
	if out["count"] != 1 {
		t.Errorf("count must be recomputed to 1, got %v", out["count"])
	}
	first := items[0].(map[string]interface{})
	if first["question"] != "Rated to 900F?" || first["answer"] != "Yes." {
		t.Errorf("question/answer not trimmed: %#v", first)
	}
	if _, ok := first["createdAt"]; !ok {
		t.Error("createdAt must be stamped server-side")
	}
}

// A client-supplied createdAt must never reach Mongo as a raw string. The driver
// cannot decode "2026-08-20" back into time.Time, so one such write makes
// cursor.All fail on EVERY product-list read for that seller, and updateProduct
// cannot repair it because it calls GetProductByID first and that read fails too.
func TestNormalizeFAQ_NeverStoresRawCreatedAt(t *testing.T) {
	cases := []struct {
		name string
		sent interface{}
	}{
		{"date-input string", "2026-08-20"},
		{"unparseable junk", "not a date at all"},
		{"wrong type entirely", 12345},
		{"nested object", map[string]interface{}{"$ne": nil}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out := normalizeFAQ(map[string]interface{}{"items": []interface{}{
				map[string]interface{}{"question": "q", "answer": "a", "createdAt": tc.sent},
			}})
			items, _ := out["items"].([]interface{})
			if len(items) != 1 {
				t.Fatalf("expected the item to survive, got %d", len(items))
			}
			got := items[0].(map[string]interface{})["createdAt"]
			if _, ok := got.(time.Time); !ok {
				t.Fatalf("createdAt stored as %T (%v); must always be time.Time or it poisons every later read", got, got)
			}
		})
	}
}

// A valid timestamp round-tripping from the portal must be preserved, not reset.
func TestNormalizeFAQ_PreservesValidCreatedAt(t *testing.T) {
	want := time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)
	out := normalizeFAQ(map[string]interface{}{"items": []interface{}{
		map[string]interface{}{"question": "q", "answer": "a", "createdAt": want.Format(time.RFC3339)},
	}})
	items, _ := out["items"].([]interface{})
	got, ok := items[0].(map[string]interface{})["createdAt"].(time.Time)
	if !ok || !got.Equal(want) {
		t.Errorf("expected the original createdAt preserved, got %v (ok=%v)", got, ok)
	}
}

// The item cap must bound document SIZE, not just item count. Appending the
// client's own map persisted any extra keys it carried, so ten items could still
// grow the document without limit.
func TestNormalizeFAQ_DropsUnknownKeys(t *testing.T) {
	out := normalizeFAQ(map[string]interface{}{"items": []interface{}{
		map[string]interface{}{
			"question": "q", "answer": "a",
			"junk": strings.Repeat("x", 5000),
		},
	}})
	items, _ := out["items"].([]interface{})
	stored := items[0].(map[string]interface{})
	if _, present := stored["junk"]; present {
		t.Error("unknown client key was persisted; the item cap then bounds count but not size")
	}
	if len(stored) != 3 {
		t.Errorf("expected exactly question/answer/createdAt, got %d keys: %v", len(stored), stored)
	}
}

func TestNormalizeFAQ_CapsItems(t *testing.T) {
	raw := make([]interface{}, 0, 25)
	for i := 0; i < 25; i++ {
		raw = append(raw, map[string]interface{}{"question": "q", "answer": "a"})
	}
	out := normalizeFAQ(map[string]interface{}{"items": raw})
	items, _ := out["items"].([]interface{})
	if len(items) != maxFAQItems {
		t.Errorf("expected cap of %d items, got %d", maxFAQItems, len(items))
	}
	if out["count"] != maxFAQItems {
		t.Errorf("count must match the capped length, got %v", out["count"])
	}
}

// Truncation must respect rune boundaries. Slicing bytes would split a multi-byte
// character and emit invalid UTF-8 directly into the PDP's ld+json block, which
// breaks the schema for every consumer parsing it.
func TestNormalizeFAQ_TruncatesOnRuneBoundary(t *testing.T) {
	longAnswer := strings.Repeat("é", maxFAQAnswer+50) // 2 bytes per rune
	out := normalizeFAQStruct2(t, longAnswer)

	if utf8.RuneCountInString(out) != maxFAQAnswer {
		t.Errorf("expected %d runes after truncation, got %d", maxFAQAnswer, utf8.RuneCountInString(out))
	}
	if !utf8.ValidString(out) {
		t.Fatal("truncation produced invalid UTF-8, which would corrupt the JSON-LD")
	}
}

// helper: runs the struct path and returns the stored answer.
func normalizeFAQStruct2(t *testing.T, answer string) string {
	t.Helper()
	faq := &storage.ProductFAQ{Items: []storage.FAQItem{{Question: "q", Answer: answer}}}
	normalizeFAQStruct(faq)
	if len(faq.Items) != 1 {
		t.Fatalf("expected the item to survive, got %d", len(faq.Items))
	}
	return faq.Items[0].Answer
}

func TestNormalizeFAQStruct_RecomputesCountAndDropsEmpties(t *testing.T) {
	faq := &storage.ProductFAQ{
		Count: 42, // client lie
		Items: []storage.FAQItem{
			{Question: " Real ", Answer: " Answer "},
			{Question: "orphan", Answer: ""},
		},
	}
	normalizeFAQStruct(faq)
	if faq.Count != 1 || len(faq.Items) != 1 {
		t.Fatalf("expected 1 item and count 1, got count=%d items=%d", faq.Count, len(faq.Items))
	}
	if faq.Items[0].Question != "Real" || faq.Items[0].Answer != "Answer" {
		t.Errorf("not trimmed: %#v", faq.Items[0])
	}
	if faq.Items[0].CreatedAt.IsZero() {
		t.Error("createdAt must be stamped")
	}
}

package generator

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"business-cart/account-service/internal/storage"
)

// Renders one product WITH an FAQ next to one WITHOUT, and asserts the present
// and absent case on both the PDP and the .md companion.
//
// The companion assertions are the point. Storefront markdown is built from its
// own product.md template rather than converted from the rendered HTML, so an
// FAQ added to product.html alone would ship answers that no AI crawler ever
// sees. That exact defect shipped on the portal /faq page (fixed in 9b03072) and
// this test is what stops it recurring here.
func TestProductFAQRendersOnPDPAndCompanion(t *testing.T) {
	dir := t.TempDir()
	g := NewGenerator("", dir, nil, "", nil, "")

	data := StorefrontData{
		AccountID: "test-account",
		Company:   &storage.CompanyData{Name: "FAQ Co", UniqueIdentifier: "faq-test"},
		Config:    &storage.D2CConfig{Enabled: true},
		Products: []ProductData{
			{
				ID: "asked", Name: "Asked Item", Slug: "asked-item",
				Category: "Gear", Price: 25.00, Stock: 5,
				Description: "Has an FAQ",
				FAQ: &ProductFAQ{
					Count: 2,
					Items: []FAQItem{
						{Question: "Are these rated to 900F?", Answer: "Yes. Tested to 932F on the palm."},
						{Question: "What size for large hands?", Answer: "Order XL."},
					},
				},
				Rating: &Rating{
					Count: 1, Average: 5,
					Reviews: []Review{{Name: "A Buyer", Rating: 5, Body: "Good", Date: time.Now()}},
				},
			},
			{
				ID: "quiet", Name: "Quiet Item", Slug: "quiet-item",
				Category: "Gear", Price: 15.00, Stock: 5,
				Description: "No FAQ",
			},
		},
	}
	if err := g.Generate(data); err != nil {
		t.Fatalf("generation failed: %v", err)
	}

	read := func(t *testing.T, glob string) string {
		t.Helper()
		matches, err := filepath.Glob(filepath.Join(dir, glob))
		if err != nil || len(matches) != 1 {
			t.Fatalf("expected exactly one file for %q, got %v (err %v)", glob, matches, err)
		}
		b, err := os.ReadFile(matches[0])
		if err != nil {
			t.Fatalf("read %s: %v", matches[0], err)
		}
		return string(b)
	}

	askedHTML := read(t, "faq-test/products/asked-item*.html")

	// Schema shape verified against schema.org/Question 2026-08-20: Question.name
	// holds the question, acceptedAnswer is an Answer, Answer.text holds the body.
	for _, want := range []string{
		`"@type": "FAQPage"`,
		`"mainEntity":`,
		`"@type":"Question"`,
		`"name":"Are these rated to 900F?"`,
		`"acceptedAnswer":{"@type":"Answer","text":"Yes. Tested to 932F on the palm."}`,
	} {
		if !strings.Contains(askedHTML, want) {
			t.Errorf("PDP JSON-LD missing %q", want)
		}
	}

	// Visible markup must be native <details>, so the answer is in the DOM whether
	// the disclosure is open or shut and the page needs no JS to reveal it.
	for _, want := range []string{
		`<details class="faq-q">`,
		`<summary>Are these rated to 900F?`,
		`class="faq-a">Yes. Tested to 932F on the palm.`,
		`Questions &amp; Answers`,
	} {
		if !strings.Contains(askedHTML, want) {
			t.Errorf("PDP markup missing %q", want)
		}
	}
	if strings.Contains(askedHTML, "faq-toggle") || strings.Contains(askedHTML, "onclick=\"faq") {
		t.Error("FAQ must not be a JS accordion; native <details> only")
	}

	// Document order encodes descending authority for an LLM reading linearly:
	// product facts, then the merchant's own answers, then third-party opinion,
	// then other products. Placed after Related Products, an answer sits beside a
	// list of OTHER product names and gets attributed to the wrong item.
	faqAt := strings.Index(askedHTML, `Questions &amp; Answers`)
	reviewsAt := strings.Index(askedHTML, `id="reviews"`)
	relatedAt := strings.Index(askedHTML, `You May Also Like`)
	if faqAt < 0 || reviewsAt < 0 || relatedAt < 0 {
		t.Fatalf("expected all three sections present (faq=%d reviews=%d related=%d)", faqAt, reviewsAt, relatedAt)
	}
	if faqAt > reviewsAt {
		t.Error("FAQ must render BEFORE Customer Reviews")
	}
	if faqAt > relatedAt {
		t.Error("FAQ must render BEFORE Related Products")
	}

	// And AFTER the buy control. Ten collapsed rows plus a 3rem divider between the
	// specs and Add to Cart is real distance on a phone; the FAQ must never push
	// the CTA down the page.
	ctaAt := strings.Index(askedHTML, "Add to Cart")
	if ctaAt < 0 {
		t.Fatal("expected an Add to Cart control on an in-stock product")
	}
	if faqAt < ctaAt {
		t.Error("FAQ must render AFTER Add to Cart, so it never pushes the CTA down")
	}

	// The companion an AI crawler actually reads.
	askedMD := read(t, "faq-test/products/asked-item*.md")
	for _, want := range []string{
		"## Questions & Answers",
		"### Are these rated to 900F?",
		"Yes. Tested to 932F on the palm.",
		"### What size for large hands?",
	} {
		if !strings.Contains(askedMD, want) {
			t.Errorf("product .md companion missing %q", want)
		}
	}
	if strings.Index(askedMD, "## Questions & Answers") > strings.Index(askedMD, "## Customer Reviews") {
		t.Error("companion: FAQ must precede Customer Reviews")
	}

	// Absent case: a product with no FAQ emits neither the section nor the schema.
	quietHTML := read(t, "faq-test/products/quiet-item*.html")
	for _, unwanted := range []string{`"@type": "FAQPage"`, `<details class="faq-q">`, `Questions &amp; Answers`} {
		if strings.Contains(quietHTML, unwanted) {
			t.Errorf("product without an FAQ still rendered %q", unwanted)
		}
	}
	quietMD := read(t, "faq-test/products/quiet-item*.md")
	if strings.Contains(quietMD, "Questions & Answers") {
		t.Error("companion for a product without an FAQ still rendered the FAQ heading")
	}
}

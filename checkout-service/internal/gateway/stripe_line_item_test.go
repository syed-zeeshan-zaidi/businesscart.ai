package gateway

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

// captureTransport records the outbound form and answers with a minimal, valid
// Stripe Checkout Session so CreateSession can be exercised without a network.
type captureTransport struct{ form url.Values }

func (c *captureTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	body, _ := io.ReadAll(r.Body)
	c.form, _ = url.ParseQuery(string(body))
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"id":"cs_test_1","url":"https://checkout.stripe.com/c/pay/cs_test_1"}`)),
		Header:     make(http.Header),
	}, nil
}

func createWithCapture(t *testing.T, req SessionRequest) url.Values {
	t.Helper()
	cap := &captureTransport{}
	orig := httpClient
	httpClient = &http.Client{Transport: cap}
	t.Cleanup(func() { httpClient = orig })

	if _, err := (&StripeGateway{}).CreateSession(context.Background(), req); err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	return cap.form
}

const nameKey = "line_items[0][price_data][product_data][name]"
const imageKey = "line_items[0][price_data][product_data][images][0]"

// The shopper arrives on Stripe's hosted page straight from a product page. A
// bare quote id as the only line item reads as an unexplained charge at the
// moment they decide whether to type a card number, so the real product label
// has to survive the handoff.
func TestCreateSessionShowsProductNameNotQuoteID(t *testing.T) {
	form := createWithCapture(t, SessionRequest{
		Amount:      29.72,
		Currency:    "USD",
		Credentials: map[string]string{"secretKey": "sk_test"},
		MerchantRef: "6a7f0b4b590cd174e2748d19",
		Description: "Heat Resistance Heavy Duty BBQ Long Gloves",
	})

	if got := form.Get(nameKey); got != "Heat Resistance Heavy Duty BBQ Long Gloves" {
		t.Errorf("line item name = %q, want the product name", got)
	}
	if strings.Contains(form.Get(nameKey), "6a7f0b4b590cd174e2748d19") {
		t.Errorf("line item name still leaks the quote id: %q", form.Get(nameKey))
	}
	// Traceability must not be traded away for readability.
	if got := form.Get("client_reference_id"); got != "6a7f0b4b590cd174e2748d19" {
		t.Errorf("client_reference_id = %q, want the quote id so support can still trace the payment", got)
	}
}

// Callers that supply no label keep the old behaviour rather than sending Stripe
// an empty product name, which it rejects.
func TestCreateSessionFallsBackToMerchantRef(t *testing.T) {
	form := createWithCapture(t, SessionRequest{
		Amount:      10,
		Currency:    "USD",
		Credentials: map[string]string{"secretKey": "sk_test"},
		MerchantRef: "abc123",
	})
	if got := form.Get(nameKey); got != "Order abc123" {
		t.Errorf("fallback name = %q, want %q", got, "Order abc123")
	}
}

// The charged amount is the quote's grand total and must not move because the
// label changed: it carries shipping, tax and discounts, and both stripe.go and
// the payment-return path re-verify it against the quote.
func TestCreateSessionAmountIsUnaffectedByLabel(t *testing.T) {
	form := createWithCapture(t, SessionRequest{
		Amount:      29.723999999999997,
		Currency:    "USD",
		Credentials: map[string]string{"secretKey": "sk_test"},
		MerchantRef: "ref",
		Description: "Some Product",
		ImageURL:    "https://cdn.example.com/a.webp",
	})
	if got := form.Get("line_items[0][price_data][unit_amount]"); got != "2972" {
		t.Errorf("unit_amount = %q, want 2972 cents", got)
	}
	if got := form.Get("line_items[0][quantity]"); got != "1" {
		t.Errorf("quantity = %q, want 1 (the total is one synthetic line)", got)
	}
}

// A merchant-supplied image field is not guaranteed to be a usable URL, and
// Stripe rejects the whole session on a bad one. Checkout must never go down
// because a product has a junk image.
func TestCreateSessionOnlyPassesUsableImages(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want bool
	}{
		{"https cdn url", "https://d10v0xlzz7lzsq.cloudfront.net/x/y.webp", true},
		{"empty", "", false},
		{"plain http", "http://example.com/a.png", false},
		{"relative path", "/images/a.png", false},
		{"not a url", "no-image-available", false},
		{"scheme only", "https://", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			form := createWithCapture(t, SessionRequest{
				Amount:      5,
				Currency:    "USD",
				Credentials: map[string]string{"secretKey": "sk_test"},
				MerchantRef: "ref",
				Description: "Product",
				ImageURL:    tc.url,
			})
			_, sent := form[imageKey]
			if sent != tc.want {
				t.Errorf("image %q sent=%v, want %v", tc.url, sent, tc.want)
			}
		})
	}
}

// Product names carry multi-byte characters (932°F, 23" gauntlets). Byte-slicing
// them at the limit would hand Stripe invalid UTF-8.
func TestTruncateRunesIsMultibyteSafe(t *testing.T) {
	s := strings.Repeat("°", 300)
	got := truncateRunes(s, 250)
	if n := len([]rune(got)); n != 250 {
		t.Errorf("got %d runes, want 250", n)
	}
	if !utf8Valid(got) {
		t.Error("truncation produced invalid UTF-8")
	}
	if short := truncateRunes("abc", 250); short != "abc" {
		t.Errorf("short string was altered: %q", short)
	}
}

func utf8Valid(s string) bool {
	for _, r := range s {
		if r == '�' {
			return false
		}
	}
	return true
}

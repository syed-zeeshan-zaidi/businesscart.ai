package order

import (
	"strings"
	"testing"
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TestCsvFieldInjection verifies CSV injection mitigation: cells that start
// with =, +, -, @, \t, \r get a leading single-quote so Excel/Sheets treat
// them as text rather than executing them as formulas. Critical because
// Generic CSV exports user-supplied fields (CustomerEmail) directly.
func TestCsvFieldInjection(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain text passthrough", "hello", "hello"},
		{"empty string passthrough", "", ""},
		{"normal email passthrough", "user@example.com", "user@example.com"},
		{"safe order id passthrough", "69f7d12fa4f35f47f34831ec", "69f7d12fa4f35f47f34831ec"},

		// Injection lead-chars must get a single-quote prefix
		{"= formula prefix", "=HYPERLINK(\"http://evil\",\"x\")", "\"'=HYPERLINK(\"\"http://evil\"\",\"\"x\"\")\""},
		{"+ formula prefix", "+1+1", "'+1+1"},
		{"- formula prefix", "-2+2", "'-2+2"},
		{"@ formula prefix", "@SUM(A1)", "'@SUM(A1)"},
		{"tab lead prefix", "\thidden", "'\thidden"},
		// \r triggers BOTH injection prefix AND RFC 4180 quote-wrap (CRLF in field)
		{"carriage return lead prefix + RFC4180 wrap", "\rhidden", "\"'\rhidden\""},

		// RFC 4180 quoting still applies
		{"comma needs quoting", "a,b", "\"a,b\""},
		{"internal quote escaped", "say \"hi\"", "\"say \"\"hi\"\"\""},
		{"newline needs quoting", "line1\nline2", "\"line1\nline2\""},

		// Combination: injection prefix THEN RFC 4180 wrap
		{"injection + comma combo", "=1,2", "\"'=1,2\""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := csvField(tc.in)
			if got != tc.want {
				t.Errorf("csvField(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// TestFormatAmount verifies money rendering. Critical because every CSV row
// (Subtotal, ShippingCost, TaxAmount, GrandTotal, Conversion Value) flows
// through this function. A silent rounding error would corrupt every order
// in every export, every accounting reconciliation, every Google Ads ROAS
// signal. The "negative-tiny -> -0.00" case is a real bug: int64() truncates
// toward zero, so int64(-0.6) is 0, but v<0 still emits the leading "-".
func TestFormatAmount(t *testing.T) {
	cases := []struct {
		name string
		in   float64
		want string
	}{
		{"zero", 0, "0.00"},
		{"one cent", 0.01, "0.01"},
		{"ten cents", 0.10, "0.10"},
		{"one dollar", 1.0, "1.00"},
		{"common price", 10.99, "10.99"},
		{"three digit dollars", 123.45, "123.45"},
		{"thousands", 1234.56, "1234.56"},
		{"large amount", 99999.99, "99999.99"},

		// Rounding behavior (half-up via +0.5 trick)
		{"rounds up at half-cent", 0.005, "0.01"},
		{"rounds down below half-cent", 0.004, "0.00"},
		{"rounds up at .995", 1.995, "2.00"},

		// Negatives (refunds, credits, statement adjustments)
		{"negative one cent", -0.01, "-0.01"},
		{"negative dollar", -1.00, "-1.00"},
		{"negative price", -10.99, "-10.99"},
		{"negative half-cent rounds away from zero", -0.005, "-0.01"},

		// REGRESSION: tiny negatives that round to zero must NOT print "-0.00"
		{"negative tiny rounds to positive zero (no sign flip)", -0.001, "0.00"},
		{"negative truly zero", -0.0, "0.00"},

		// Float32 / float64 inexactness — common shapes that appear in tax math
		{"float-imprecise 0.1+0.2", 0.1 + 0.2, "0.30"},
		{"float-imprecise tax of 8.25%", 32.97 * 0.0825, "2.72"}, // 2.720025... -> 2.72
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := formatAmount(tc.in)
			if got != tc.want {
				t.Errorf("formatAmount(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// TestFormatGenericCSV verifies the full CSV row shape with attribution.
// Anchors the contract that downstream accounting/spreadsheet imports rely
// on (column order, money precision, click-id columns).
func TestFormatGenericCSV(t *testing.T) {
	created, _ := time.Parse(time.RFC3339, "2026-05-04T14:30:00Z")
	id, _ := primitive.ObjectIDFromHex("69f9128f39bbfdee5c1810d8")
	orders := []*Order{
		{
			ID:              id,
			CreatedAt:       created,
			Status:          "shipped",
			CustomerEmail:   "buyer@example.com",
			PaymentMethod:   "credit_card",
			DeliveryMethod:  "shipping_out",
			Subtotal:        32.97,
			ShippingCost:    15.00,
			TaxAmount:       2.72,
			GrandTotal:      50.69,
			Items:           make([]cart.CartItem, 3),
			PromoCode:       "SAVE10",
			PromoDiscount:   3.30,
			TrackingNumber:  "1Z999",
			TrackingCarrier: "ups",
			VisitorID:       "v_abc",
			ClickIDs:        map[string]string{"gclid": "Cj0xyz", "msclkid": "ms_456"},
		},
	}
	out := FormatGenericCSV(orders)

	// Header anchors column positions for spreadsheet imports
	wantHeader := "Order ID,Created (UTC),Status,Customer Email,Payment Method,Delivery Method,Subtotal,Shipping,Tax,Discount,Promo Code,Grand Total,Refunded,Net Total,Items,Tracking Number,Tracking Carrier,Visitor ID,gclid,msclkid"
	if !strings.HasPrefix(out, wantHeader) {
		t.Errorf("CSV header mismatch.\n got: %q\nwant prefix: %q", strings.SplitN(out, "\n", 2)[0], wantHeader)
	}

	// Money values, attribution, and item count must all be present
	wants := []string{
		"69f9128f39bbfdee5c1810d8",
		"2026-05-04 14:30:00",
		"shipped",
		"buyer@example.com",
		"32.97", "15.00", "2.72", "3.30", "SAVE10", "50.69",
		",3,", // Items column
		"1Z999",
		"ups",
		"v_abc",
		"Cj0xyz",
		"ms_456",
	}
	for _, w := range wants {
		if !strings.Contains(out, w) {
			t.Errorf("CSV missing %q\nfull output:\n%s", w, out)
		}
	}
}

// TestFormatGoogleCSV verifies (1) the required Parameters preamble and
// header, (2) only orders with gclid are emitted, (3) Order ID is included
// as the dedupe key Google uses on re-upload.
func TestFormatGoogleCSV(t *testing.T) {
	id1, _ := primitive.ObjectIDFromHex("69f9128f39bbfdee5c1810d8")
	id2, _ := primitive.ObjectIDFromHex("69f9128f39bbfdee5c1810d9")
	created, _ := time.Parse(time.RFC3339, "2026-05-04T14:30:00Z")
	orders := []*Order{
		{ID: id1, CreatedAt: created, GrandTotal: 50.69, ClickIDs: map[string]string{"gclid": "Cj0xyz"}},
		{ID: id2, CreatedAt: created, GrandTotal: 99.99, ClickIDs: map[string]string{"msclkid": "ms_only"}}, // no gclid -> excluded
	}
	out := FormatGoogleCSV(orders, "")

	if !strings.Contains(out, "Parameters:TimeZone=+0000") {
		t.Errorf("missing required Parameters preamble:\n%s", out)
	}
	if !strings.Contains(out, "Cj0xyz") {
		t.Errorf("missing gclid row")
	}
	if strings.Contains(out, "ms_only") {
		t.Errorf("BREACH: Google CSV must exclude rows without gclid")
	}
	if !strings.Contains(out, "Purchase") {
		t.Errorf("default conversion name 'Purchase' missing")
	}
	if !strings.Contains(out, "69f9128f39bbfdee5c1810d8") {
		t.Errorf("Order ID column missing — required for re-upload dedupe")
	}
	if !strings.Contains(out, ",USD") {
		t.Errorf("Currency column missing")
	}

	// Custom conversion name override
	out2 := FormatGoogleCSV(orders, "Signup")
	if !strings.Contains(out2, "Signup") {
		t.Errorf("custom conversionName not applied")
	}
}

// TestFormatBingCSV verifies the Microsoft Bulk schema: Format Version
// preamble, "Offline Conversion" Type literal, and msclkid-only filtering.
func TestFormatBingCSV(t *testing.T) {
	id1, _ := primitive.ObjectIDFromHex("69f9128f39bbfdee5c1810d8")
	id2, _ := primitive.ObjectIDFromHex("69f9128f39bbfdee5c1810d9")
	created, _ := time.Parse(time.RFC3339, "2026-05-04T14:30:00Z")
	orders := []*Order{
		{ID: id1, CreatedAt: created, GrandTotal: 50.69, ClickIDs: map[string]string{"msclkid": "ms_456"}},
		{ID: id2, CreatedAt: created, GrandTotal: 99.99, ClickIDs: map[string]string{"gclid": "g_only"}}, // no msclkid -> excluded
	}
	out := FormatBingCSV(orders, "")

	if !strings.Contains(out, "Format Version,,,,,6.0,,,,,") {
		t.Errorf("missing required Format Version row")
	}
	if !strings.Contains(out, "Offline Conversion") {
		t.Errorf("missing required Type literal")
	}
	if !strings.Contains(out, "ms_456") {
		t.Errorf("missing msclkid row")
	}
	if strings.Contains(out, "g_only") {
		t.Errorf("BREACH: Bing CSV must exclude rows without msclkid")
	}
	// ISO 8601 with Z (Microsoft requires UTC, not the +0000 offset Google uses)
	if !strings.Contains(out, "2026-05-04T14:30:00Z") {
		t.Errorf("missing ISO 8601 Conversion Time")
	}
}

// Roadmap #9: refunds must reach the export layer. Before this, all three exports
// wrote GrandTotal, so an 83%-refunded order shipped its full pre-refund value as
// the conversion value to Google and Microsoft, inflating reported ROAS and
// training bidding on revenue that had been handed back.
func TestExportsUseNetTotalAfterRefunds(t *testing.T) {
	orders := []*Order{
		{
			CreatedAt:  time.Date(2026, 6, 8, 14, 30, 0, 0, time.UTC),
			GrandTotal: 209.97,
			Refunds:    []Refund{{Amount: 174.98}},
			ClickIDs:   map[string]string{"gclid": "Cj0xyz", "msclkid": "ms_456"},
		},
	}

	// Accounting export keeps gross AND reports the refund next to it, so the file
	// still reconciles against the payment processor.
	generic := FormatGenericCSV(orders)
	for _, want := range []string{"209.97", "174.98", "34.99"} {
		if !strings.Contains(generic, want) {
			t.Errorf("generic CSV missing %q\ngot: %s", want, generic)
		}
	}

	// Ad platforms get NET only. Asserting the gross value is absent is the part
	// that actually fails if someone reverts to GrandTotal.
	for name, out := range map[string]string{
		"google": FormatGoogleCSV(orders, "Purchase"),
		"bing":   FormatBingCSV(orders, "Purchase"),
	} {
		if !strings.Contains(out, "34.99") {
			t.Errorf("%s CSV should carry net 34.99\ngot: %s", name, out)
		}
		if strings.Contains(out, "209.97") {
			t.Errorf("%s CSV leaked gross 209.97 instead of net\ngot: %s", name, out)
		}
	}
}

// A refund larger than the order must never produce a negative conversion value.
func TestExportsClampOverRefundToZero(t *testing.T) {
	orders := []*Order{{
		CreatedAt:  time.Date(2026, 6, 8, 14, 30, 0, 0, time.UTC),
		GrandTotal: 50,
		Refunds:    []Refund{{Amount: 80}},
		ClickIDs:   map[string]string{"gclid": "Cj0xyz"},
	}}
	out := FormatGoogleCSV(orders, "Purchase")
	// Check the value column itself, not the whole file: the timestamp legitimately
	// contains hyphens. A negative amount would render as ",-30.00" (or "'-30.00"
	// once the CSV-injection guard prefixes it).
	if strings.Contains(out, ",-") || strings.Contains(out, ",'-") {
		t.Errorf("over-refund produced a negative conversion value\ngot: %s", out)
	}
	if !strings.Contains(out, ",0.00,USD") {
		t.Errorf("over-refund should clamp the conversion value to 0.00\ngot: %s", out)
	}
}

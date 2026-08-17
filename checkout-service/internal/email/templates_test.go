package email

import (
	"strings"
	"testing"
)

// TestOrderConfirmationTextBreakdown pins the customer-facing receipt content.
// Critical because this is where a customer verifies "did my SAVE10 apply?"
// after checkout. Wrong here = customer pays the discounted total but the
// email gives no signal that the coupon applied, generating support requests.
func TestOrderConfirmationTextBreakdown(t *testing.T) {
	t.Run("with promo discount: shows breakdown + discount line + code", func(t *testing.T) {
		body := orderConfirmationText(OrderConfirmationData{
			OrderID:       "abc123def456",
			Subtotal:      32.97,
			ShippingCost:  15.00,
			TaxAmount:     2.72,
			PromoCode:     "SAVE10",
			PromoDiscount: 3.30,
			GrandTotal:    47.39,
			BrandName:     "Acme",
		})
		mustContain(t, body, "Subtotal: $32.97")
		mustContain(t, body, "Shipping: $15.00")
		mustContain(t, body, "Tax:      $2.72")
		mustContain(t, body, "Discount (SAVE10): -$3.30")
		mustContain(t, body, "Total:    $47.39")
	})

	t.Run("with discount but no code: shows discount line without code label", func(t *testing.T) {
		body := orderConfirmationText(OrderConfirmationData{
			OrderID:       "xyz",
			Subtotal:      50,
			TaxAmount:     0,
			ShippingCost:  0,
			PromoCode:     "",
			PromoDiscount: 5.00,
			GrandTotal:    45,
		})
		mustContain(t, body, "Discount: -$5.00")
		mustNotContain(t, body, "Discount (")
	})

	t.Run("zero promo discount: discount line omitted entirely", func(t *testing.T) {
		body := orderConfirmationText(OrderConfirmationData{
			OrderID:      "xyz",
			Subtotal:     50,
			ShippingCost: 10,
			TaxAmount:    5,
			GrandTotal:   65,
		})
		mustContain(t, body, "Subtotal: $50.00")
		mustContain(t, body, "Total:    $65.00")
		mustNotContain(t, body, "Discount")
	})

	t.Run("legacy single-total fallback when only GrandTotal set", func(t *testing.T) {
		body := orderConfirmationText(OrderConfirmationData{
			OrderID:    "xyz",
			GrandTotal: 100,
		})
		mustContain(t, body, "Total: $100.00")
		mustNotContain(t, body, "Subtotal:")
	})

	t.Run("HTML template renders discount row when PromoDiscount > 0", func(t *testing.T) {
		html := renderHTML(orderConfirmationHTMLTmpl, OrderConfirmationData{
			OrderID:       "abc",
			Subtotal:      32.97,
			ShippingCost:  15.00,
			TaxAmount:     2.72,
			PromoCode:     "SAVE10",
			PromoDiscount: 3.30,
			GrandTotal:    47.39,
		})
		mustContain(t, html, "Discount (SAVE10)")
		mustContain(t, html, "-$3.30")
		mustContain(t, html, "$47.39") // grand total
	})

	t.Run("HTML template omits discount row when PromoDiscount == 0", func(t *testing.T) {
		html := renderHTML(orderConfirmationHTMLTmpl, OrderConfirmationData{
			OrderID:    "abc",
			Subtotal:   32.97,
			GrandTotal: 32.97,
		})
		mustNotContain(t, html, "Discount")
		mustContain(t, html, "$32.97")
	})
}

// TestNewOrderToCompanyTextBreakdown pins the merchant-facing notification.
// Critical because the merchant needs to reconcile a discounted GrandTotal
// against list price; without the breakdown they cannot tell why a $50 cart
// is being recorded as $45.
func TestNewOrderToCompanyTextBreakdown(t *testing.T) {
	t.Run("with promo: breakdown + discount line", func(t *testing.T) {
		body := newOrderToCompanyText(NewOrderToCompanyData{
			OrderID:       "abc",
			CustomerEmail: "buyer@example.com",
			Subtotal:      32.97,
			ShippingCost:  15.00,
			TaxAmount:     2.72,
			PromoCode:     "SAVE10",
			PromoDiscount: 3.30,
			GrandTotal:    47.39,
		})
		mustContain(t, body, "Subtotal: $32.97")
		mustContain(t, body, "Discount (SAVE10): -$3.30")
		mustContain(t, body, "Total:    $47.39")
	})

	t.Run("zero discount: no discount line", func(t *testing.T) {
		body := newOrderToCompanyText(NewOrderToCompanyData{
			OrderID:    "xyz",
			Subtotal:   50,
			GrandTotal: 50,
		})
		mustContain(t, body, "Subtotal: $50.00")
		mustNotContain(t, body, "Discount")
	})

	t.Run("legacy fallback: only GrandTotal set", func(t *testing.T) {
		body := newOrderToCompanyText(NewOrderToCompanyData{
			OrderID:    "xyz",
			GrandTotal: 100,
		})
		mustContain(t, body, "Total: $100.00")
		mustNotContain(t, body, "Subtotal:")
	})

	t.Run("HTML renders discount row when promo present", func(t *testing.T) {
		html := renderHTML(newOrderToCompanyHTMLTmpl, NewOrderToCompanyData{
			OrderID:       "abc",
			CustomerEmail: "buyer@example.com",
			Subtotal:      32.97,
			ShippingCost:  15.00,
			TaxAmount:     2.72,
			PromoCode:     "SAVE10",
			PromoDiscount: 3.30,
			GrandTotal:    47.39,
		})
		mustContain(t, html, "Discount (SAVE10)")
		mustContain(t, html, "-$3.30")
	})
}

func mustContain(t *testing.T, body, want string) {
	t.Helper()
	if !strings.Contains(body, want) {
		t.Errorf("body missing %q\nfull body:\n%s", want, body)
	}
}

func mustNotContain(t *testing.T, body, banned string) {
	t.Helper()
	if strings.Contains(body, banned) {
		t.Errorf("body unexpectedly contains %q\nfull body:\n%s", banned, body)
	}
}

// Roadmap #9: the statement gained refund + net rows. Both bodies are rendered
// here because an HTML template error is a RUNTIME failure that compiles fine and
// would ship a broken or blank statement to a paying seller. Also pins that a
// period with no refunds renders exactly as it did before.
func TestMonthlyStatementRefundRows(t *testing.T) {
	base := MonthlyStatementData{
		CompanyName: "uSetGo", PeriodLabel: "June 2026", Tier: "Starter",
		OrderCount: 3, TotalGrandTotal: 209.97, MonthlyFee: 0,
		PerOrderRateStr: "6%, capped at $5/order", TransactionFees: 2.10, TotalDue: 2.10,
	}

	clean := MonthlyStatementMessage("a@b.com", base)
	if !strings.Contains(clean.HTMLBody, "209.97") {
		t.Errorf("HTML did not render gross revenue; template likely errored:\n%s", clean.HTMLBody)
	}
	if strings.Contains(clean.HTMLBody, "Refunds issued") || strings.Contains(clean.TextBody, "Refunds issued") {
		t.Error("a period with no refunds must not show refund rows")
	}

	withRefund := base
	withRefund.TotalRefunded = 174.98
	r := MonthlyStatementMessage("a@b.com", withRefund)
	for _, want := range []string{"Refunds issued", "174.98", "Net revenue", "34.99"} {
		if !strings.Contains(r.HTMLBody, want) {
			t.Errorf("HTML body missing %q:\n%s", want, r.HTMLBody)
		}
		if !strings.Contains(r.TextBody, want) {
			t.Errorf("text body missing %q:\n%s", want, r.TextBody)
		}
	}
}

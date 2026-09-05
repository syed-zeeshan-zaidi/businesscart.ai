package statement

import (
	"math"
	"time"

	"github.com/syed/businesscart/checkout-service/internal/order"
)

// round2 snaps a money figure to whole cents.
//
// Every value this package produces is a dollar amount held in float64, and the
// fee is a raw product (rate * net) that lands on fractions of a cent: 6% of a
// $0.90 order is 0.054. That value was being stored on the snapshot and emailed
// as "$0.05", so the billing record and the invoice disagreed, and a column of
// such rows in the portal summed to a total that did not match the rows above
// it. Rounding once, here, where the figures are produced, keeps the snapshot,
// the email, the portal and any export agreeing to the cent.
//
// The SUM of the per-order fees is rounded, not each order, because the
// statement bills one aggregate "transaction fees" line rather than per-order
// lines. Rounding per order would drift from that line by a cent per order.
func round2(f float64) float64 {
	return math.Round(f*100) / 100
}

// Compute derives the billing tier and fees from a period's orders.
// Brackets:
//
//	Starter    ≤100 orders/mo  → $0/mo + 6% per order, capped at $5
//	Growth     101–1000        → $499/mo + 1% per order, no cap
//	Enterprise 1001+           → $1,999/mo + 0.25% per order, no cap
//
// Pure function — no DB calls. Mirrors web-portal/src/tier.ts; keep them
// synchronized so admin and company always see the same numbers.
func Compute(sellerID string, from, to time.Time, orders []*order.Order) Computed {
	count := len(orders)
	var grandTotal, refunded float64
	for _, o := range orders {
		grandTotal += o.GrandTotal
		refunded += o.TotalRefunded()
	}

	var tier string
	var monthlyFee, perOrderRate float64
	var perOrderCap *float64
	switch {
	case count <= 100:
		tier = "Starter"
		monthlyFee = 0
		perOrderRate = 0.06
		cap := 5.0
		perOrderCap = &cap
	case count <= 1000:
		tier = "Growth"
		monthlyFee = 499
		perOrderRate = 0.01
	default:
		tier = "Enterprise"
		monthlyFee = 1999
		perOrderRate = 0.0025
	}

	// Fees are charged on NetTotal, not GrandTotal: a seller must not pay a
	// percentage on money they handed back. The cap still applies per order, and
	// a fully refunded order contributes a fee of 0 rather than being dropped, so
	// OrderCount (which sets the tier) is untouched by refunds.
	var fees float64
	for _, o := range orders {
		fee := perOrderRate * o.NetTotal()
		if perOrderCap != nil && fee > *perOrderCap {
			fee = *perOrderCap
		}
		fees += fee
	}

	roundedFees := round2(fees)

	return Computed{
		SellerID:    sellerID,
		PeriodStart: from,
		PeriodEnd:   to,
		OrderCount:  count,
		// GrandTotal stays GROSS on purpose: the statement email labels this line
		// "gross revenue", so netting it here would make that label a lie. Refunds
		// are reported alongside it and the fee above is what actually uses net.
		TotalGrandTotal: round2(grandTotal),
		TotalRefunded:   round2(refunded),
		Tier:            tier,
		MonthlyFee:      monthlyFee,
		PerOrderRate:    perOrderRate,
		PerOrderCap:     perOrderCap,
		TransactionFees: roundedFees,
		TotalDue:        round2(monthlyFee + roundedFees),
	}
}

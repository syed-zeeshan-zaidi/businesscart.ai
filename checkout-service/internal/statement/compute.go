package statement

import (
	"time"

	"github.com/syed/businesscart/checkout-service/internal/order"
)

// Compute derives the billing tier and fees from a period's orders.
// Brackets:
//   Starter    ≤100 orders/mo  → $0/mo + 6% per order, capped at $5
//   Growth     101–1000        → $499/mo + 1% per order, no cap
//   Enterprise 1001+           → $1,999/mo + 0.25% per order, no cap
//
// Pure function — no DB calls. Mirrors web-portal/src/tier.ts; keep them
// synchronized so admin and company always see the same numbers.
func Compute(sellerID string, from, to time.Time, orders []*order.Order) Computed {
	count := len(orders)
	var grandTotal float64
	for _, o := range orders {
		grandTotal += o.GrandTotal
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

	var fees float64
	for _, o := range orders {
		fee := perOrderRate * o.GrandTotal
		if perOrderCap != nil && fee > *perOrderCap {
			fee = *perOrderCap
		}
		fees += fee
	}

	return Computed{
		SellerID:        sellerID,
		PeriodStart:     from,
		PeriodEnd:       to,
		OrderCount:      count,
		TotalGrandTotal: grandTotal,
		Tier:            tier,
		MonthlyFee:      monthlyFee,
		PerOrderRate:    perOrderRate,
		PerOrderCap:     perOrderCap,
		TransactionFees: fees,
		TotalDue:        monthlyFee + fees,
	}
}

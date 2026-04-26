package order

import "time"

// Statement is the billing statement for a seller over a time period. It is a
// derivative of Order data — never persisted, always recomputed from current
// orders. See exclude/APPLICATION.md "Pricing Model" for tier brackets.
//
// Mirrors web-portal/src/tier.ts TierInfo. Keep these two in sync — both
// must produce identical numbers for the same set of orders.
type Statement struct {
	SellerID        string    `json:"sellerId"`
	PeriodStart     time.Time `json:"periodStart"`
	PeriodEnd       time.Time `json:"periodEnd"`
	OrderCount      int       `json:"orderCount"`
	TotalGrandTotal float64   `json:"totalGrandTotal"`
	Tier            string    `json:"tier"`
	MonthlyFee      float64   `json:"monthlyFee"`
	PerOrderRate    float64   `json:"perOrderRate"`
	PerOrderCap     *float64  `json:"perOrderCap,omitempty"`
	TransactionFees float64   `json:"transactionFees"`
	TotalDue        float64   `json:"totalDue"`
}

// ComputeStatement derives the billing tier and fees from a period's orders.
// Brackets:
//   Starter    ≤100 orders/mo  → $0/mo + 6% per order, capped at $5
//   Growth     101–1000        → $499/mo + 1% per order, no cap
//   Enterprise 1001+           → $1,999/mo + 0.25% per order, no cap
//
// Pure function — no DB calls, easy to unit-test.
func ComputeStatement(sellerID string, from, to time.Time, orders []*Order) Statement {
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

	return Statement{
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

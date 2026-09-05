package statement

import (
	"math"
	"testing"
	"time"

	"github.com/syed/businesscart/checkout-service/internal/order"
)

// TestCompute pins the billing-tier math. This is what we charge sellers.
// A regression here = invoicing customers wrong = trust + revenue loss.
//
// Tier brackets (must match web-portal/src/tier.ts):
//
//	Starter    [0, 100]    -> $0 + 6% per order capped at $5
//	Growth     [101, 1000] -> $499 + 1% per order, no cap
//	Enterprise [1001, inf) -> $1999 + 0.25% per order, no cap
func TestCompute(t *testing.T) {
	from := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	five := 5.0

	makeOrders := func(n int, total float64) []*order.Order {
		out := make([]*order.Order, n)
		for i := range out {
			out[i] = &order.Order{GrandTotal: total}
		}
		return out
	}

	cases := []struct {
		name             string
		orders           []*order.Order
		wantTier         string
		wantMonthlyFee   float64
		wantPerOrderRate float64
		wantCap          *float64
		wantFees         float64
		wantTotalDue     float64
		wantGrandTotal   float64
	}{
		// Starter tier: free + 6% capped at $5
		{
			name:             "no orders -> Starter, zero fees",
			orders:           nil,
			wantTier:         "Starter",
			wantMonthlyFee:   0,
			wantPerOrderRate: 0.06,
			wantCap:          &five,
			wantFees:         0,
			wantTotalDue:     0,
			wantGrandTotal:   0,
		},
		{
			name:             "Starter small order: 6% under cap",
			orders:           makeOrders(1, 50.00), // 6% of 50 = 3.00, under $5 cap
			wantTier:         "Starter",
			wantMonthlyFee:   0,
			wantPerOrderRate: 0.06,
			wantCap:          &five,
			wantFees:         3.00,
			wantTotalDue:     3.00,
			wantGrandTotal:   50.00,
		},
		{
			name:             "Starter large order: capped at $5",
			orders:           makeOrders(1, 1000.00), // 6% of 1000 = $60, capped to $5
			wantTier:         "Starter",
			wantMonthlyFee:   0,
			wantPerOrderRate: 0.06,
			wantCap:          &five,
			wantFees:         5.00,
			wantTotalDue:     5.00,
			wantGrandTotal:   1000.00,
		},
		{
			name:             "Starter at-cap-boundary order: 6% of $83.33 = $5.00",
			orders:           makeOrders(1, 83.34),
			wantTier:         "Starter",
			wantPerOrderRate: 0.06,
			wantCap:          &five,
			wantFees:         5.00, // 0.06*83.34 = 5.0004 -> capped
			wantTotalDue:     5.00,
			wantGrandTotal:   83.34,
		},
		{
			name:             "Starter mixed: small + large, cap applied per-order",
			orders:           append(makeOrders(1, 50.00), makeOrders(1, 1000.00)...),
			wantTier:         "Starter",
			wantPerOrderRate: 0.06,
			wantCap:          &five,
			wantFees:         3.00 + 5.00, // 3.00 (under cap) + 5.00 (capped)
			wantTotalDue:     8.00,
			wantGrandTotal:   1050.00,
		},

		// Tier boundaries — off-by-one here = wrong tier = wrong bill
		{
			name:             "100 orders: still Starter (inclusive upper bound)",
			orders:           makeOrders(100, 10.00), // 0.06*10 = 0.60 each, under cap
			wantTier:         "Starter",
			wantMonthlyFee:   0,
			wantPerOrderRate: 0.06,
			wantCap:          &five,
			wantFees:         60.00, // 100 * 0.60
			wantTotalDue:     60.00,
			wantGrandTotal:   1000.00,
		},
		{
			name:             "101 orders: Growth (Starter ceiling crossed)",
			orders:           makeOrders(101, 100.00),
			wantTier:         "Growth",
			wantMonthlyFee:   499,
			wantPerOrderRate: 0.01,
			wantCap:          nil,        // no cap on Growth
			wantFees:         101 * 1.00, // 1% of 100
			wantTotalDue:     499 + 101.00,
			wantGrandTotal:   10100.00,
		},
		{
			name:             "1000 orders: still Growth",
			orders:           makeOrders(1000, 50.00),
			wantTier:         "Growth",
			wantMonthlyFee:   499,
			wantPerOrderRate: 0.01,
			wantCap:          nil,
			wantFees:         1000 * 0.50, // 1% of 50
			wantTotalDue:     499 + 500.00,
			wantGrandTotal:   50000.00,
		},
		{
			name:             "1001 orders: Enterprise",
			orders:           makeOrders(1001, 100.00),
			wantTier:         "Enterprise",
			wantMonthlyFee:   1999,
			wantPerOrderRate: 0.0025,
			wantCap:          nil,
			wantFees:         1001 * 0.25, // 0.25% of 100
			wantTotalDue:     1999 + 250.25,
			wantGrandTotal:   100100.00,
		},

		// Growth has NO cap — a single huge order pays 1% in full
		{
			name:             "Growth: huge order pays full 1%, no cap",
			orders:           makeOrders(101, 10000.00),
			wantTier:         "Growth",
			wantMonthlyFee:   499,
			wantPerOrderRate: 0.01,
			wantCap:          nil,
			wantFees:         101 * 100.00,
			wantTotalDue:     499 + 10100.00,
			wantGrandTotal:   1010000.00,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Compute("seller_x", from, to, tc.orders)

			if got.SellerID != "seller_x" {
				t.Errorf("SellerID = %q", got.SellerID)
			}
			if !got.PeriodStart.Equal(from) || !got.PeriodEnd.Equal(to) {
				t.Errorf("period not propagated: %v..%v", got.PeriodStart, got.PeriodEnd)
			}
			if got.OrderCount != len(tc.orders) {
				t.Errorf("OrderCount = %d, want %d", got.OrderCount, len(tc.orders))
			}
			if got.Tier != tc.wantTier {
				t.Errorf("Tier = %q, want %q", got.Tier, tc.wantTier)
			}
			if got.MonthlyFee != tc.wantMonthlyFee {
				t.Errorf("MonthlyFee = %v, want %v", got.MonthlyFee, tc.wantMonthlyFee)
			}
			if got.PerOrderRate != tc.wantPerOrderRate {
				t.Errorf("PerOrderRate = %v, want %v", got.PerOrderRate, tc.wantPerOrderRate)
			}
			if (got.PerOrderCap == nil) != (tc.wantCap == nil) {
				t.Errorf("PerOrderCap nil-ness mismatch: got %v want %v", got.PerOrderCap, tc.wantCap)
			} else if got.PerOrderCap != nil && *got.PerOrderCap != *tc.wantCap {
				t.Errorf("PerOrderCap = %v, want %v", *got.PerOrderCap, *tc.wantCap)
			}
			if math.Abs(got.TransactionFees-tc.wantFees) > 0.001 {
				t.Errorf("TransactionFees = %v, want %v", got.TransactionFees, tc.wantFees)
			}
			if math.Abs(got.TotalDue-tc.wantTotalDue) > 0.001 {
				t.Errorf("TotalDue = %v, want %v", got.TotalDue, tc.wantTotalDue)
			}
			if math.Abs(got.TotalGrandTotal-tc.wantGrandTotal) > 0.001 {
				t.Errorf("TotalGrandTotal = %v, want %v", got.TotalGrandTotal, tc.wantGrandTotal)
			}
		})
	}
}

// Roadmap #9: transaction fees are charged on NET revenue. Before this, a seller
// who refunded most of an order still paid the percentage on the pre-refund
// figure. Uses the real production shape: $209.97 order, $174.98 refunded.
func TestCompute_FeesChargedOnNetNotGross(t *testing.T) {
	from := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)
	orders := []*order.Order{
		{GrandTotal: 209.97, Refunds: []order.Refund{{Amount: 174.98}}},
	}

	got := Compute("seller1", from, to, orders)

	// Starter tier: 6% capped at $5. 6% of net 34.99 = 2.0994, billed as 2.10;
	// 6% of gross would be 12.60, which the $5 cap would then mask as 5.00 — so
	// the cap is exactly why this needs asserting on the uncapped side of the
	// boundary. Asserted exactly, not within a cent, because a cent of slack here
	// is the whole subject of the rounding test below.
	if got.TransactionFees != 2.10 {
		t.Errorf("TransactionFees = %v, want exactly 2.10 (6%% of net 34.99, rounded)", got.TransactionFees)
	}
	// Gross is still reported gross: the statement email labels it "gross revenue".
	if math.Abs(got.TotalGrandTotal-209.97) > 0.001 {
		t.Errorf("TotalGrandTotal = %v, want 209.97 (gross, not netted)", got.TotalGrandTotal)
	}
	if math.Abs(got.TotalRefunded-174.98) > 0.001 {
		t.Errorf("TotalRefunded = %v, want 174.98", got.TotalRefunded)
	}
	// Refunds must not change the tier: the order still happened.
	if got.OrderCount != 1 {
		t.Errorf("OrderCount = %v, want 1 (refunds do not remove an order)", got.OrderCount)
	}
}

// A fully refunded order contributes no fee but is still a counted order.
func TestCompute_FullyRefundedOrderCostsNoFee(t *testing.T) {
	from := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)
	orders := []*order.Order{
		{GrandTotal: 100, Refunds: []order.Refund{{Amount: 100}}},
	}

	got := Compute("seller1", from, to, orders)

	if got.TransactionFees != 0 {
		t.Errorf("TransactionFees = %v, want 0 for a fully refunded order", got.TransactionFees)
	}
	if got.OrderCount != 1 {
		t.Errorf("OrderCount = %v, want 1", got.OrderCount)
	}
}

// Money is rounded to whole cents at the point it is produced.
//
// This is the real production shape that exposed it: uSetGo's May 2026
// statement, one $0.90 order on Starter, where 6% is 0.054. That value was
// stored on the snapshot and emailed as "$0.05", so the billing record and the
// invoice disagreed, and a portal column of such rows summed to a total that did
// not match the rows above it.
//
// Guard when touching Compute: revert round2 and this test fails with
// 0.054000000000000006, which is also why it asserts equality rather than a
// tolerance. Run with -count=1; Go caches passes.
func TestCompute_MoneyRoundedToCents(t *testing.T) {
	from := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 1, 0)
	orders := []*order.Order{{GrandTotal: 0.90}}

	got := Compute("seller1", from, to, orders)

	if got.TransactionFees != 0.05 {
		t.Errorf("TransactionFees = %v, want exactly 0.05 (6%% of 0.90 = 0.054)", got.TransactionFees)
	}
	if got.TotalDue != 0.05 {
		t.Errorf("TotalDue = %v, want exactly 0.05", got.TotalDue)
	}

	// Rounding goes up as well as down: 6% of 1.30 is 0.078.
	up := Compute("seller1", from, to, []*order.Order{{GrandTotal: 1.30}})
	if up.TransactionFees != 0.08 {
		t.Errorf("TransactionFees = %v, want exactly 0.08 (6%% of 1.30 = 0.078)", up.TransactionFees)
	}

	// KNOWN LIMIT, asserted so it cannot change unnoticed. A decimal half-cent is
	// NOT resolved by a decimal rounding rule, because the binary product is
	// already off the decimal value: 6% of 2.75 is 0.16499999999999998, not
	// 0.165, so it rounds DOWN to 0.16 where "round half up" on the decimal
	// would give 0.17. A half cent, on a boundary case, in the platform's
	// favour. Rounding is a strict improvement on storing 0.054, but the real
	// fix is integer cents end to end, which is a money-model change touching
	// every read path and belongs on the roadmap, not in this test.
	half := Compute("seller1", from, to, []*order.Order{{GrandTotal: 2.75}})
	if half.TransactionFees != 0.16 {
		t.Errorf("TransactionFees = %v, want 0.16 (binary 6%% of 2.75 is just under the half cent)", half.TransactionFees)
	}

	// The total must equal the parts a reader can see, never a re-derivation
	// from unrounded internals.
	if half.TotalDue != half.MonthlyFee+half.TransactionFees {
		t.Errorf("TotalDue %v != MonthlyFee %v + TransactionFees %v", half.TotalDue, half.MonthlyFee, half.TransactionFees)
	}
}

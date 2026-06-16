package order

import (
	"testing"
	"time"
)

// Pure-function tests for the refund computed methods. No DB required.

func TestOrder_TotalRefunded(t *testing.T) {
	cases := []struct {
		name string
		o    Order
		want float64
	}{
		{"no refunds returns zero", Order{GrandTotal: 100}, 0},
		{"single partial refund", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 30}},
		}, 30},
		{"sum of multiple refunds", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 30}, {Amount: 20.50}, {Amount: 5}},
		}, 55.50},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.o.TotalRefunded()
			if got != tc.want {
				t.Errorf("TotalRefunded() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestOrder_NetTotal(t *testing.T) {
	cases := []struct {
		name string
		o    Order
		want float64
	}{
		{"no refunds equals grand total", Order{GrandTotal: 100}, 100},
		{"partial refund reduces total", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 30}},
		}, 70},
		{"full refund yields zero", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 100}},
		}, 0},
		// Defensive: refunds totalling more than grandTotal should clamp at 0,
		// not go negative. Production should never hit this thanks to the cap
		// check in service.UpdateOrder, but the computed method must not lie.
		{"over-refund clamps to zero", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 150}},
		}, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.o.NetTotal()
			if got != tc.want {
				t.Errorf("NetTotal() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestOrder_RefundStatus(t *testing.T) {
	now := time.Now()
	cases := []struct {
		name string
		o    Order
		want string
	}{
		{"no refunds returns empty", Order{GrandTotal: 100}, ""},
		{"partial refund returns partial", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 30, RefundedAt: now}},
		}, "partial"},
		{"refund summing to grand total returns full", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 60, RefundedAt: now}, {Amount: 40, RefundedAt: now}},
		}, "full"},
		{"refund exceeding grand total still full", Order{
			GrandTotal: 100,
			Refunds:    []Refund{{Amount: 120, RefundedAt: now}},
		}, "full"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.o.RefundStatus()
			if got != tc.want {
				t.Errorf("RefundStatus() = %q, want %q", got, tc.want)
			}
		})
	}
}

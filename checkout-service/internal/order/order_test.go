package order

import (
	"testing"
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
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

func TestOrder_KeepOnlyItemsForPartner(t *testing.T) {
	partnerA := "partner_a_id"
	partnerB := "partner_b_id"
	cases := []struct {
		name      string
		items     []cart.CartItem
		partnerID string
		wantIDs   []string
	}{
		{
			name:      "no items yields no items",
			items:     nil,
			partnerID: partnerA,
			wantIDs:   nil,
		},
		{
			name: "all items match are kept",
			items: []cart.CartItem{
				{ProductID: "p1", PartnerID: partnerA},
				{ProductID: "p2", PartnerID: partnerA},
			},
			partnerID: partnerA,
			wantIDs:   []string{"p1", "p2"},
		},
		{
			name: "no items match yields empty",
			items: []cart.CartItem{
				{ProductID: "p1", PartnerID: ""},
				{ProductID: "p2", PartnerID: partnerB},
			},
			partnerID: partnerA,
			wantIDs:   []string{},
		},
		{
			name: "mixed order keeps only partner items",
			items: []cart.CartItem{
				{ProductID: "p1", PartnerID: partnerA},
				{ProductID: "p2", PartnerID: ""}, // company's own
				{ProductID: "p3", PartnerID: partnerB},
				{ProductID: "p4", PartnerID: partnerA},
			},
			partnerID: partnerA,
			wantIDs:   []string{"p1", "p4"},
		},
		{
			name: "empty partner id matches company-only items",
			items: []cart.CartItem{
				{ProductID: "p1", PartnerID: ""},
				{ProductID: "p2", PartnerID: partnerA},
			},
			partnerID: "",
			wantIDs:   []string{"p1"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			o := &Order{Items: tc.items}
			o.KeepOnlyItemsForPartner(tc.partnerID)
			if len(o.Items) != len(tc.wantIDs) {
				t.Fatalf("len(Items) = %d, want %d", len(o.Items), len(tc.wantIDs))
			}
			for i, want := range tc.wantIDs {
				if o.Items[i].ProductID != want {
					t.Errorf("Items[%d].ProductID = %q, want %q", i, o.Items[i].ProductID, want)
				}
			}
		})
	}
}

func TestOrder_KeepOnlyItemsForPartner_PreservesMoneyFields(t *testing.T) {
	// Regression guard: filter is items-only; GrandTotal/Subtotal/TaxAmount stay
	// as whole-order values. UI is responsible for showing N/A to partner.
	o := &Order{
		GrandTotal:   199.99,
		Subtotal:     180.00,
		TaxAmount:    12.99,
		ShippingCost: 7.00,
		Items: []cart.CartItem{
			{ProductID: "p1", PartnerID: "partner_a", Price: 50},
			{ProductID: "p2", PartnerID: "", Price: 130},
		},
	}
	o.KeepOnlyItemsForPartner("partner_a")
	if o.GrandTotal != 199.99 || o.Subtotal != 180.00 || o.TaxAmount != 12.99 || o.ShippingCost != 7.00 {
		t.Errorf("money fields mutated: grandTotal=%v subtotal=%v tax=%v shipping=%v",
			o.GrandTotal, o.Subtotal, o.TaxAmount, o.ShippingCost)
	}
	if len(o.Items) != 1 || o.Items[0].ProductID != "p1" {
		t.Errorf("Items filter wrong: %+v", o.Items)
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

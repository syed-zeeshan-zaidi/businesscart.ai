package cart

import (
	"math"
	"testing"
)

// TestCalculateTotals pins the cart pricing rules. This is the single source
// of truth for what every customer pays at checkout — drift here corrupts
// every quote, every order, every statement, every PPC conversion value.
//
// Rules verified:
//  1. DiscountedPrice > 0 overrides Price (negotiated/tier price wins).
//  2. DiscountedPrice == 0 falls back to Price (default state, omitempty zero).
//  3. DiscountedPrice < 0 also falls back to Price (the > 0 guard, not != 0,
//     so a stray negative does not silently apply as a credit).
//  4. ProposedPrice is ignored — it is the proposal-stage placeholder, not
//     the effective price.
//  5. LineItemTotal = effective price × quantity.
//  6. TotalPrice = sum of LineItemTotals across all items.
//  7. Empty cart -> TotalPrice = 0.
func TestCalculateTotals(t *testing.T) {
	s := &Service{} // calculateTotals never touches s.collection

	cases := []struct {
		name        string
		items       []CartItem
		wantLines   []float64
		wantTotal   float64
	}{
		{
			name:      "empty cart",
			items:     []CartItem{},
			wantLines: []float64{},
			wantTotal: 0,
		},
		{
			name: "single item, no discount",
			items: []CartItem{
				{Price: 10.99, Quantity: 3},
			},
			wantLines: []float64{32.97},
			wantTotal: 32.97,
		},
		{
			name: "single item, DiscountedPrice wins over Price",
			items: []CartItem{
				{Price: 20.00, DiscountedPrice: 16.00, Quantity: 5},
			},
			wantLines: []float64{80.00},
			wantTotal: 80.00,
		},
		{
			name: "DiscountedPrice == 0 falls back to Price",
			items: []CartItem{
				{Price: 10.00, DiscountedPrice: 0, Quantity: 2},
			},
			wantLines: []float64{20.00},
			wantTotal: 20.00,
		},
		{
			name: "DiscountedPrice < 0 falls back to Price (no negative credit)",
			items: []CartItem{
				{Price: 10.00, DiscountedPrice: -5.00, Quantity: 2},
			},
			wantLines: []float64{20.00},
			wantTotal: 20.00,
		},
		{
			name: "ProposedPrice does not affect totals",
			items: []CartItem{
				{Price: 10.00, ProposedPrice: 5.00, Quantity: 2},
			},
			wantLines: []float64{20.00},
			wantTotal: 20.00,
		},
		{
			name: "multiple items mix of discounted and not",
			items: []CartItem{
				{Price: 10.99, Quantity: 3},
				{Price: 20.00, DiscountedPrice: 16.00, Quantity: 5},
				{Price: 5.00, Quantity: 1},
			},
			wantLines: []float64{32.97, 80.00, 5.00},
			wantTotal: 117.97,
		},
		{
			name: "quantity zero yields zero line",
			items: []CartItem{
				{Price: 10.00, Quantity: 0},
				{Price: 5.00, Quantity: 4},
			},
			wantLines: []float64{0, 20.00},
			wantTotal: 20.00,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := &Cart{Items: append([]CartItem(nil), tc.items...)}
			s.calculateTotals(c)

			for i, want := range tc.wantLines {
				got := c.Items[i].LineItemTotal
				if math.Abs(got-want) > 0.001 {
					t.Errorf("item[%d] LineItemTotal = %v, want %v", i, got, want)
				}
			}
			if math.Abs(c.TotalPrice-tc.wantTotal) > 0.001 {
				t.Errorf("TotalPrice = %v, want %v", c.TotalPrice, tc.wantTotal)
			}
		})
	}
}

package promotion

import "testing"

// TestApplyPromotion verifies the hardcoded coupon codes return the correct
// discount amount, normalize case and whitespace, and return zero for any
// unknown or empty input. Critical because this is the only authority that
// decides what a coupon code is worth.
func TestApplyPromotion(t *testing.T) {
	s := NewService()
	cases := []struct {
		name     string
		subtotal float64
		code     string
		want     float64
	}{
		{"SAVE10 uppercase", 100, "SAVE10", 10},
		{"SAVE10 lowercase normalized", 100, "save10", 10},
		{"SAVE10 mixed case normalized", 100, "Save10", 10},
		{"SAVE10 with surrounding whitespace trimmed", 100, "  SAVE10  ", 10},
		{"SAVE5 uppercase", 100, "SAVE5", 5},
		{"SAVE5 lowercase normalized", 100, "save5", 5},
		{"SAVE5 with whitespace trimmed", 200, " save5 ", 10},
		{"unknown code returns zero", 100, "SAVE99", 0},
		{"empty code returns zero", 100, "", 0},
		{"whitespace-only code returns zero", 100, "   ", 0},
		{"SAVE5 on $0 subtotal returns zero", 0, "SAVE5", 0},
		{"SAVE10 fractional subtotal", 99.99, "SAVE10", 9.999},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := s.ApplyPromotion(tc.subtotal, tc.code)
			if got != tc.want {
				t.Errorf("ApplyPromotion(%v, %q) = %v, want %v", tc.subtotal, tc.code, got, tc.want)
			}
		})
	}
}

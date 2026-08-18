package handler

import (
	"testing"

	"github.com/syed/businesscart/checkout-service/internal/cart"
)

func TestCheckoutLineLabel(t *testing.T) {
	cases := []struct {
		name  string
		items []cart.CartItem
		want  string
	}{
		{"no items", nil, ""},
		{
			"single item single unit",
			[]cart.CartItem{{Name: "Heat Resistance Heavy Duty BBQ Long Gloves", Quantity: 1}},
			"Heat Resistance Heavy Duty BBQ Long Gloves",
		},
		{
			"single item multiple units",
			[]cart.CartItem{{Name: "Sports Ankle Brace", Quantity: 3}},
			"Sports Ankle Brace (x3)",
		},
		{
			"multiple items",
			[]cart.CartItem{{Name: "Welding Gloves", Quantity: 1}, {Name: "Oven Mitts", Quantity: 2}},
			"Welding Gloves + 1 more",
		},
		{
			// A missing name is merchant data, not a platform failure: skip the blank
			// and label from the next item that has one rather than showing "".
			"first item unnamed",
			[]cart.CartItem{{Name: "  ", Quantity: 1}, {Name: "Oven Mitts", Quantity: 1}},
			"Oven Mitts",
		},
		{"all unnamed falls through to the gateway default", []cart.CartItem{{Name: "", Quantity: 1}}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := checkoutLineLabel(tc.items); got != tc.want {
				t.Errorf("checkoutLineLabel = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestCheckoutLineImage(t *testing.T) {
	cases := []struct {
		name  string
		items []cart.CartItem
		want  string
	}{
		{"no items", nil, ""},
		{"first has image", []cart.CartItem{{Image: "https://cdn/a.webp"}}, "https://cdn/a.webp"},
		{
			// The thumbnail need not come from the first line: a merchant who left one
			// product imageless should not cost the whole cart its picture.
			"falls through to the first item that has one",
			[]cart.CartItem{{Image: ""}, {Image: "https://cdn/b.webp"}},
			"https://cdn/b.webp",
		},
		{"none have images", []cart.CartItem{{Image: ""}, {Image: "   "}}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := checkoutLineImage(tc.items); got != tc.want {
				t.Errorf("checkoutLineImage = %q, want %q", got, tc.want)
			}
		})
	}
}

package generator

import "testing"

// numString and dimsString decide whether a package-spec row renders at all, so
// the "absent" cases matter as much as the formatting ones: a zero must produce
// "" and not "0", or every product without dimensions grows a bogus spec row.
func TestNumString(t *testing.T) {
	cases := []struct {
		name string
		in   float64
		want string
	}{
		{"absent renders nothing", 0, ""},
		{"negative renders nothing", -3, ""},
		{"whole number drops the decimal", 12, "12"},
		{"fraction is preserved", 2.5, "2.5"},
		{"trailing zeros are trimmed", 12.50, "12.5"},
		{"sub-pound weight", 0.75, "0.75"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := numString(c.in); got != c.want {
				t.Errorf("numString(%v) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestDimsString(t *testing.T) {
	cases := []struct {
		name    string
		l, w, h float64
		want    string
	}{
		{"all three", 12, 8, 4, "12 x 8 x 4"},
		{"none set renders nothing", 0, 0, 0, ""},
		{"partial entry skips the blank axis", 12, 0, 4, "12 x 4"},
		{"single axis", 0, 0, 4, "4"},
		{"fractions preserved", 12.5, 8.25, 4, "12.5 x 8.25 x 4"},
		{"negative axis is dropped, not printed", 12, -8, 4, "12 x 4"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := dimsString(c.l, c.w, c.h); got != c.want {
				t.Errorf("dimsString(%v,%v,%v) = %q, want %q", c.l, c.w, c.h, got, c.want)
			}
		})
	}
}

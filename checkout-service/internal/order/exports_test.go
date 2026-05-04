package order

import "testing"

// TestCsvFieldInjection verifies CSV injection mitigation: cells that start
// with =, +, -, @, \t, \r get a leading single-quote so Excel/Sheets treat
// them as text rather than executing them as formulas. Critical because
// Generic CSV exports user-supplied fields (CustomerEmail) directly.
func TestCsvFieldInjection(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain text passthrough", "hello", "hello"},
		{"empty string passthrough", "", ""},
		{"normal email passthrough", "user@example.com", "user@example.com"},
		{"safe order id passthrough", "69f7d12fa4f35f47f34831ec", "69f7d12fa4f35f47f34831ec"},

		// Injection lead-chars must get a single-quote prefix
		{"= formula prefix", "=HYPERLINK(\"http://evil\",\"x\")", "\"'=HYPERLINK(\"\"http://evil\"\",\"\"x\"\")\""},
		{"+ formula prefix", "+1+1", "'+1+1"},
		{"- formula prefix", "-2+2", "'-2+2"},
		{"@ formula prefix", "@SUM(A1)", "'@SUM(A1)"},
		{"tab lead prefix", "\thidden", "'\thidden"},
		// \r triggers BOTH injection prefix AND RFC 4180 quote-wrap (CRLF in field)
		{"carriage return lead prefix + RFC4180 wrap", "\rhidden", "\"'\rhidden\""},

		// RFC 4180 quoting still applies
		{"comma needs quoting", "a,b", "\"a,b\""},
		{"internal quote escaped", "say \"hi\"", "\"say \"\"hi\"\"\""},
		{"newline needs quoting", "line1\nline2", "\"line1\nline2\""},

		// Combination: injection prefix THEN RFC 4180 wrap
		{"injection + comma combo", "=1,2", "\"'=1,2\""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := csvField(tc.in)
			if got != tc.want {
				t.Errorf("csvField(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

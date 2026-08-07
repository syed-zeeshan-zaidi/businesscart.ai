package handler

import "testing"

// Cost is confidential twice over: from buyers (Roadmap #40) and from staff
// inside the seller who are not senior enough to see it (Roadmap #35g).
func TestHidesCost(t *testing.T) {
	cases := []struct {
		name     string
		role     string
		orgRole  string
		wantHide bool
	}{
		{"buyer never sees cost", "customer", "", true},
		{"storefront shopper never sees cost", "b2c", "", true},
		{"seller owner sees cost", "company", "owner", false},
		{"seller admin sees cost", "company", "admin", false},
		{"seller staff does NOT see cost", "company", "user", true},
		// Absent claim must not hide: it is absent on platform-admin tokens, and
		// blanking an owner's own margins would be worse than the leak it prevents.
		{"platform admin sees cost", "admin", "", false},
		{"company token with no org_role is not restricted", "company", "", false},
		// A buyer's org_role must never re-open the buyer rule.
		{"a buying org's owner still never sees cost", "customer", "owner", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := hidesCost(c.role, c.orgRole); got != c.wantHide {
				t.Fatalf("hidesCost(%q,%q) = %v, want %v", c.role, c.orgRole, got, c.wantHide)
			}
		})
	}
}

package handler

import (
	"testing"

	"business-cart/catalog-service/internal/storage"
)

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

// Who may read a single product. The partner case was silently wrong: ownership
// was measured only against product.SellerID, which is the company whose
// catalogue the product appears in and never the partner, so a partner could see
// their own product in the LIST (scoped on partnerId) and then get 403 fetching
// that same product by id.
func TestProductAccess(t *testing.T) {
	const company, partner, buyer = "co1", "pa1", "cu1"
	own := &storage.Product{SellerID: company, PartnerID: partner}
	plain := &storage.Product{SellerID: company}
	other := &storage.Product{SellerID: "co2"}

	cases := []struct {
		name       string
		role       string
		accountID  string
		orgID      string
		assoc      []string
		p          *storage.Product
		allowed    bool
		asCustomer bool
	}{
		{"admin reads anything", "admin", "ad1", "ad1", nil, other, true, false},
		{"company reads its own", "company", company, company, nil, plain, true, false},
		{"company staff read via org", "company", "staff1", company, nil, plain, true, false},
		{"company cannot read another seller's", "company", company, company, nil, other, false, false},

		{"PARTNER reads the product they supply", "partner", partner, partner, nil, own, true, false},
		{"partner cannot read a product they do not supply", "partner", partner, partner, nil, plain, false, false},
		{"partner cannot read another seller's", "partner", partner, partner, nil, other, false, false},

		{"attached customer reads", "customer", buyer, buyer, []string{company}, plain, true, true},
		{"unattached customer refused", "customer", buyer, buyer, []string{"co9"}, plain, false, false},
		{"b2c attached reads", "b2c", buyer, buyer, []string{company}, plain, true, true},

		{"nil product refused", "company", company, company, nil, nil, false, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := productAccess(c.role, c.accountID, c.orgID, c.assoc, c.p)
			if got.allowed != c.allowed || got.asCustomer != c.asCustomer {
				t.Fatalf("productAccess = %+v, want allowed=%v asCustomer=%v", got, c.allowed, c.asCustomer)
			}
		})
	}
}

// Only a customer is barred from an inactive product: the company that owns it
// and the partner that supplies it both need to see it while it is switched off.
func TestProductAccess_InactiveOnlyBlocksCustomers(t *testing.T) {
	p := &storage.Product{SellerID: "co1", PartnerID: "pa1"}
	if productAccess("company", "co1", "co1", nil, p).asCustomer {
		t.Fatal("a company must not be treated as a customer, or inactive products vanish from its own catalogue")
	}
	if productAccess("partner", "pa1", "pa1", nil, p).asCustomer {
		t.Fatal("a partner must not be treated as a customer")
	}
	if !productAccess("customer", "cu1", "cu1", []string{"co1"}, p).asCustomer {
		t.Fatal("a customer must be flagged so the inactive check applies")
	}
}

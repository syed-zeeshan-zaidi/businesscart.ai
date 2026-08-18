package generator

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"business-cart/account-service/internal/storage"
)

// The determinism test renders every PDP but its fixtures carry no weight or
// dimensions, so the package-spec branches never execute there. This renders a
// product that HAS them next to one that does not, and asserts both the present
// and the absent case on the PDP and on the .md companion.
func TestPackageSpecsRenderOnlyWhenSet(t *testing.T) {
	dir := t.TempDir()
	g := NewGenerator("", dir, nil, "", nil, "")

	data := StorefrontData{
		AccountID: "test-account",
		Company:   &storage.CompanyData{Name: "Package Co", UniqueIdentifier: "pkg-test"},
		Config:    &storage.D2CConfig{Enabled: true},
		Products: []ProductData{
			{
				ID: "boxed", Name: "Boxed Item", Slug: "boxed-item",
				Category: "Gear", Price: 25.00, Stock: 5,
				Description: "Has a package spec",
				Weight:      2.5, Length: 12, Width: 8, Height: 4,
				// Feed-only campaign metadata. Asserted below to stay OFF the page.
				CustomLabel0: "ZZlowmarginZZ", CustomLabel4: "ZZclearancedumpZZ",
			},
			{
				ID: "plain", Name: "Plain Item", Slug: "plain-item",
				Category: "Gear", Price: 15.00, Stock: 5,
				Description: "No package spec",
			},
		},
	}
	if err := g.Generate(data); err != nil {
		t.Fatalf("generation failed: %v", err)
	}

	read := func(t *testing.T, glob string) string {
		t.Helper()
		matches, err := filepath.Glob(filepath.Join(dir, glob))
		if err != nil || len(matches) != 1 {
			t.Fatalf("expected exactly one file for %q, got %v (err %v)", glob, matches, err)
		}
		b, err := os.ReadFile(matches[0])
		if err != nil {
			t.Fatalf("read %s: %v", matches[0], err)
		}
		return string(b)
	}

	boxedHTML := read(t, "pkg-test/products/boxed-item*.html")
	for _, want := range []string{"Shipping Weight", "2.5 lb", "Package Dimensions", "12 x 8 x 4 in"} {
		if !strings.Contains(boxedHTML, want) {
			t.Errorf("PDP for the boxed product is missing %q", want)
		}
	}

	// The absent case is the one that regresses quietly: a product with no
	// package data must not grow an empty "Shipping Weight:" row, and must not
	// render a Specifications block that exists only to hold nothing.
	plainHTML := read(t, "pkg-test/products/plain-item*.html")
	for _, unwanted := range []string{"Shipping Weight", "Package Dimensions", "Specifications"} {
		if strings.Contains(plainHTML, unwanted) {
			t.Errorf("PDP for the product with no package data unexpectedly contains %q", unwanted)
		}
	}

	boxedMD := read(t, "pkg-test/products/boxed-item*.md")
	for _, want := range []string{"- **Shipping Weight**: 2.5 lb", "- **Package Dimensions**: 12 x 8 x 4 in"} {
		if !strings.Contains(boxedMD, want) {
			t.Errorf("md companion for the boxed product is missing %q", want)
		}
	}

	plainMD := read(t, "pkg-test/products/plain-item*.md")
	for _, unwanted := range []string{"Shipping Weight", "Package Dimensions"} {
		if strings.Contains(plainMD, unwanted) {
			t.Errorf("md companion for the product with no package data unexpectedly contains %q", unwanted)
		}
	}

	// Custom labels are internal campaign metadata and must never surface to a
	// shopper. ProductData carries them so the FEEDS can read them, which is
	// exactly the condition under which a careless template edit would start
	// printing "low-margin" on the product page.
	for name, page := range map[string]string{"PDP": boxedHTML, "md companion": boxedMD} {
		for _, leaked := range []string{"ZZlowmarginZZ", "ZZclearancedumpZZ"} {
			if strings.Contains(page, leaked) {
				t.Errorf("%s leaked the internal custom label %q to shoppers", name, leaked)
			}
		}
	}
}

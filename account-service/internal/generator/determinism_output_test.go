package generator

import (
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"time"

	"business-cart/account-service/internal/storage"
)

// The property #31 is really about: the SAME catalogue must produce the SAME
// bytes. The two sort fixes address the cause we found (map iteration order in
// the category nav), but this asserts the outcome, so any future nondeterminism
// anywhere in generation fails here rather than surfacing as a noisy byte-diff
// months later.
//
// Deliberately generates twice in one process. Go seeds map iteration randomly
// per range, so two runs in the same process is exactly the condition that used
// to reorder the nav.
func TestGenerateIsByteIdenticalAcrossRuns(t *testing.T) {
	// Several categories share a product count, which is the tie that used to
	// reshuffle the footer, and the primaries deliberately arrive out of order.
	products := []ProductData{}
	add := func(name, cat string, price float64) {
		products = append(products, ProductData{
			ID: name, Name: name, Category: cat, Price: price,
			Description: name + " description", Slug: name,
			// A real change date, as the catalog supplies. Without one the sitemap
			// and .md companions would simply omit the field, which is also stable.
			UpdatedAt: time.Date(2026, 7, 4, 9, 30, 0, 0, time.UTC),
		})
	}
	add("Welding Gloves", "Gloves/Welding", 39.99)
	add("Winter Gloves", "Gloves/Winter", 19.99)
	add("BBQ Gloves", "Gloves/BBQ", 24.99)
	add("Oven Mitts", "Oven Mitts", 16.80)
	add("Apron", "Aprons", 12.00)
	add("Ankle Brace", "Sports", 14.99)
	add("Second Mitt", "Oven Mitts", 18.00)
	add("Second Apron", "Aprons", 13.00)

	run := func(dir string) map[string]string {
		g := NewGenerator("", dir, nil, "", nil, "")
		data := StorefrontData{
			AccountID: "test-account",
			Company:   &storage.CompanyData{Name: "Determinism Co", UniqueIdentifier: "det-test"},
			Config:    &storage.D2CConfig{Enabled: true},
			Products:  products,
		}
		if err := g.Generate(data); err != nil {
			t.Fatalf("generation failed: %v", err)
		}
		// Files that embed the generation time by design, so they can never be
		// byte-stable and are not what this test is about. Worth knowing: that
		// timestamp lands in EVERY product .md companion and in sitemap.xml's
		// lastmod, so those still churn on every regen even with ordering fixed.
		// Tracked separately; see the note added to Roadmap #31.
		// llms.txt keeps a "Last generated" line on purpose: it is informational
		// for an LLM consumer and one churning file is a fair price. privacy and
		// terms render a "Last updated" from the same stamp, which is a separate
		// question about legal-document dating (see Roadmap #31b) and is not what
		// this test is about. Everything else must be byte-stable, INCLUDING the
		// sitemap and the .md companions, which used to churn on every regen.
		stamped := func(rel string) bool {
			base := filepath.Base(rel)
			return base == "llms.txt" || base == "privacy.html" || base == "terms.html"
		}
		sums := map[string]string{}
		_ = filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			b, rErr := os.ReadFile(p)
			if rErr != nil {
				return nil
			}
			rel, _ := filepath.Rel(dir, p)
			if stamped(rel) {
				return nil
			}
			h := sha256.Sum256(b)
			sums[rel] = hex.EncodeToString(h[:])
			return nil
		})
		return sums
	}

	a := run(t.TempDir())
	b := run(t.TempDir())

	if len(a) == 0 {
		t.Fatal("generator produced no files; the comparison below would be vacuous")
	}
	if len(a) != len(b) {
		t.Fatalf("run 1 produced %d files, run 2 produced %d", len(a), len(b))
	}
	var differing []string
	for name, sumA := range a {
		if b[name] != sumA {
			differing = append(differing, name)
		}
	}
	if len(differing) > 0 {
		t.Fatalf("%d of %d generated files differ between two identical runs: %v",
			len(differing), len(a), differing)
	}
	t.Logf("%d generated files (excluding time-stamped ones) byte-identical across two runs", len(a))
}

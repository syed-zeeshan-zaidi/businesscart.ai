package generator

import (
	"encoding/csv"
	"strings"
	"testing"

	"business-cart/account-service/internal/storage"
)

// Channel support for package specs is NOT uniform, and the whole point of these
// tests is that a future "just add it everywhere" change fails loudly:
//
//	Google    weight + length/width/height
//	Bing      weight only
//	Facebook  weight only
//	Pinterest weight + width/height (no length field exists)
//	TikTok    weight only
func packageSpecData() StorefrontData {
	return StorefrontData{
		Domain:  "example.com",
		Company: &storage.CompanyData{Name: "Package Co", UniqueIdentifier: "pkg"},
		Products: []ProductData{
			{ID: "full", Name: "Full Specs", Slug: "full", Filename: "full",
				Category: "Gear / Boxed", Price: 25, Stock: 5,
				Weight: 2.5, Length: 12, Width: 8, Height: 4,
				// A comma in a merchant-typed label is ordinary ("Premium, High
				// Margin") and must survive as ONE field, not split the row.
				CustomLabel0: "premium", CustomLabel1: "Premium, High Margin",
				CustomLabel2: `has "quotes"`, CustomLabel3: "q4", CustomLabel4: "clearance"},
			{ID: "weightonly", Name: "Weight Only", Slug: "wo", Filename: "wo",
				Category: "Gear", Price: 15, Stock: 5,
				Weight: 1.25},
			{ID: "partial", Name: "Partial Dims", Slug: "pd", Filename: "pd",
				Category: "Gear", Price: 10, Stock: 5,
				Length: 12, Height: 4}, // width missing on purpose
			{ID: "none", Name: "No Specs", Slug: "ns", Filename: "ns",
				Category: "Gear", Price: 5, Stock: 5},
		},
	}
}

func TestGoogleFeedPackageSpecs(t *testing.T) {
	out, err := buildGoogleFeed(packageSpecData())
	if err != nil {
		t.Fatalf("buildGoogleFeed: %v", err)
	}
	feed := string(out)

	for _, want := range []string{
		"<g:shipping_weight>2.5 lb</g:shipping_weight>",
		"<g:shipping_length>12 in</g:shipping_length>",
		"<g:shipping_width>8 in</g:shipping_width>",
		"<g:shipping_height>4 in</g:shipping_height>",
		"<g:shipping_weight>1.25 lb</g:shipping_weight>",
	} {
		if !strings.Contains(feed, want) {
			t.Errorf("google feed missing %s", want)
		}
	}

	// Exactly two products have a usable weight, and exactly ONE has a complete
	// set of dimensions. The partial-dimension product must contribute nothing:
	// Google states that without all three the data cannot be used at all.
	if got := strings.Count(feed, "<g:shipping_weight>"); got != 2 {
		t.Errorf("expected 2 shipping_weight elements, got %d", got)
	}
	for _, tag := range []string{"shipping_length", "shipping_width", "shipping_height"} {
		if got := strings.Count(feed, "<g:"+tag+">"); got != 1 {
			t.Errorf("expected exactly 1 <g:%s>, got %d (a partial dimension set must emit none)", tag, got)
		}
	}
}

// A feed whose header and rows disagree on column count silently shifts every
// value after the mismatch into the wrong field, which is far worse than a
// missing attribute.
//
// The CSV feeds are parsed with encoding/csv rather than counted by separator:
// a merchant label containing a comma is legitimately quoted, so a naive count
// would both false-alarm and fail to prove the row is actually well formed.
// csv.Reader errors on a ragged record, which is exactly the assertion.
func TestDelimitedFeedsColumnParity(t *testing.T) {
	data := packageSpecData()

	for _, c := range []struct {
		name  string
		build func(StorefrontData) ([]byte, error)
	}{
		{"facebook", buildFacebookFeed},
		{"pinterest", buildPinterestFeed},
		{"tiktok", buildTikTokFeed},
	} {
		t.Run(c.name, func(t *testing.T) {
			out, err := c.build(data)
			if err != nil {
				t.Fatalf("build: %v", err)
			}
			records, err := csv.NewReader(strings.NewReader(string(out))).ReadAll()
			if err != nil {
				t.Fatalf("feed is not valid CSV (ragged or unbalanced quotes): %v", err)
			}
			if len(records) < 2 {
				t.Fatalf("expected a header plus rows, got %d record(s)", len(records))
			}
			// Round-trip the hostile label: it must come back as ONE field with
			// its comma intact, proving the quoting is real and not luck.
			var found bool
			for _, rec := range records[1:] {
				for _, f := range rec {
					if f == "Premium, High Margin" {
						found = true
					}
				}
			}
			if !found {
				t.Error("the comma-bearing custom label did not survive as a single field")
			}
		})
	}

	t.Run("bing", func(t *testing.T) {
		out, err := buildBingFeed(data)
		if err != nil {
			t.Fatalf("build: %v", err)
		}
		// TSV has no quoting; tsvSafe strips tabs, so a raw count is correct here.
		lines := strings.Split(strings.TrimRight(string(out), "\n"), "\n")
		if len(lines) < 2 {
			t.Fatalf("expected a header plus rows, got %d line(s)", len(lines))
		}
		want := strings.Count(lines[0], "\t")
		for i, line := range lines[1:] {
			if got := strings.Count(line, "\t"); got != want {
				t.Errorf("row %d has %d tabs, header has %d", i+1, got, want)
			}
		}
	})
}

// Custom labels are internal campaign metadata ("low-margin", "clearance") and
// are explicitly invisible to shoppers. They belong in feeds ONLY: leaking one
// onto a product page would publish the merchant's own commercial notes.
func TestCustomLabelsReachFeedsButNotTheStorefront(t *testing.T) {
	data := packageSpecData()

	for _, c := range []struct {
		name  string
		build func(StorefrontData) ([]byte, error)
	}{
		{"google", buildGoogleFeed},
		{"facebook", buildFacebookFeed},
		{"pinterest", buildPinterestFeed},
		{"tiktok", buildTikTokFeed},
		{"bing", buildBingFeed},
	} {
		t.Run(c.name+" emits labels", func(t *testing.T) {
			out, err := c.build(data)
			if err != nil {
				t.Fatalf("build: %v", err)
			}
			feed := string(out)
			for i, want := range []string{"custom_label_0", "custom_label_4"} {
				if !strings.Contains(feed, want) {
					t.Errorf("missing %s column (index %d)", want, i)
				}
			}
			if !strings.Contains(feed, "premium") || !strings.Contains(feed, "clearance") {
				t.Error("label values missing from the feed body")
			}
		})
	}

	t.Run("google uses g-namespaced label tags", func(t *testing.T) {
		out, _ := buildGoogleFeed(data)
		if !strings.Contains(string(out), "<g:custom_label_0>premium</g:custom_label_0>") {
			t.Error("expected a g:custom_label_0 element")
		}
		// A product with no labels must emit no empty label elements.
		if got := strings.Count(string(out), "<g:custom_label_0>"); got != 1 {
			t.Errorf("expected exactly 1 custom_label_0 element, got %d", got)
		}
	})

	t.Run("tiktok now carries product_type", func(t *testing.T) {
		out, _ := buildTikTokFeed(data)
		feed := string(out)
		if !strings.Contains(feed, "product_type") {
			t.Error("tiktok feed is missing the product_type column")
		}
		if !strings.Contains(feed, "Gear > Boxed") {
			t.Error("tiktok feed is missing the site taxonomy value")
		}
	})
}

func TestDelimitedFeedsPackageSpecSupport(t *testing.T) {
	data := packageSpecData()

	weightOnly := []struct {
		name  string
		build func(StorefrontData) ([]byte, error)
	}{
		{"facebook", buildFacebookFeed},
		{"tiktok", buildTikTokFeed},
		{"bing", buildBingFeed},
	}
	for _, c := range weightOnly {
		t.Run(c.name, func(t *testing.T) {
			out, err := c.build(data)
			if err != nil {
				t.Fatalf("build: %v", err)
			}
			feed := string(out)
			if !strings.Contains(feed, "shipping_weight") {
				t.Error("expected a shipping_weight column")
			}
			if !strings.Contains(feed, "2.5 lb") {
				t.Error("expected the weight value 2.5 lb in a row")
			}
			// These channels have no dimension fields at all; emitting one would
			// be inventing an attribute their spec does not define.
			for _, unwanted := range []string{"shipping_length", "shipping_width", "shipping_height"} {
				if strings.Contains(feed, unwanted) {
					t.Errorf("%s does not support %s but the feed emits it", c.name, unwanted)
				}
			}
		})
	}

	t.Run("pinterest", func(t *testing.T) {
		out, err := buildPinterestFeed(data)
		if err != nil {
			t.Fatalf("build: %v", err)
		}
		feed := string(out)
		for _, want := range []string{"shipping_weight", "shipping_width", "shipping_height", "2.5 lb", "8 in", "4 in"} {
			if !strings.Contains(feed, want) {
				t.Errorf("pinterest feed missing %q", want)
			}
		}
		// Pinterest's spec has width and height but NO length field.
		if strings.Contains(feed, "shipping_length") {
			t.Error("pinterest has no shipping_length field but the feed emits it")
		}
		// The 12 in length must not leak into some other column either.
		if strings.Contains(feed, "12 in") {
			t.Error("pinterest feed contains the length value, which it has no field for")
		}
	})
}

func TestFeedShippingHelpers(t *testing.T) {
	t.Run("weight out of range is omitted", func(t *testing.T) {
		if got := feedShippingWeight(ProductData{Weight: 2001}); got != "" {
			t.Errorf("expected \"\" above Google's 2000 lb limit, got %q", got)
		}
		if got := feedShippingWeight(ProductData{Weight: 2000}); got != "2000 lb" {
			t.Errorf("expected the limit itself to be allowed, got %q", got)
		}
	})

	t.Run("dimensions need all three", func(t *testing.T) {
		l, w, h := feedShippingDims(ProductData{Length: 12, Width: 8})
		if l != "" || w != "" || h != "" {
			t.Errorf("a partial set must emit nothing, got %q/%q/%q", l, w, h)
		}
	})

	t.Run("dimension out of range drops the whole set", func(t *testing.T) {
		// One unusable axis makes the trio unusable, because Google cannot use
		// the data without all three.
		l, w, h := feedShippingDims(ProductData{Length: 200, Width: 8, Height: 4})
		if l != "" || w != "" || h != "" {
			t.Errorf("expected the whole set dropped, got %q/%q/%q", l, w, h)
		}
	})
}

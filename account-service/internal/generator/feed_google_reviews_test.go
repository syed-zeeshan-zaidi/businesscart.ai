package generator

import (
	"business-cart/account-service/internal/storage"
	"strings"
	"testing"
	"time"
)

func TestGoogleReviewsFeed_SchemaMatchesV24(t *testing.T) {
	verified := true
	data := StorefrontData{
		Domain: "www.usetgo.com",
		Company: &storage.CompanyData{
			Name:    "uSetGo",
			LogoURL: "https://www.usetgo.com/favicon.ico",
		},
		Products: []ProductData{
			{
				ID:       "68d587240f94e737534b8866",
				Name:     "Adult Welding Gloves",
				SKU:      "AWG-001",
				Barcode:  "0123456789012",
				Filename: "adult-welding-gloves-4b8866",
				Active:   &verified,
				Rating: &Rating{
					Count:   2,
					Average: 4.5,
					Reviews: []Review{
						{
							Name:     "Mark T.",
							Rating:   5,
							Title:    "Worth the extra",
							Body:     "Cuff is long enough.",
							Verified: true,
							Date:     time.Date(2026, 5, 18, 10, 30, 0, 0, time.UTC),
						},
						{
							// anonymous fallback (empty Name)
							Rating: 4,
							Body:   "Solid for the price.",
							Date:   time.Date(2026, 4, 8, 0, 0, 0, 0, time.UTC),
						},
					},
				},
			},
		},
	}

	out, err := buildGoogleReviewsFeed(data)
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}
	xml := string(out)

	// Schema v2.4 invariants
	mustContain := []string{
		`<feed>`,
		`<version>2.4</version>`,
		`<publisher>`,
		`<name>uSetGo</name>`,
		`<favicon>https://www.usetgo.com/favicon.ico</favicon>`,
		`<reviews>`,
		`<review>`,
		`<review_id>`,
		`<reviewer>`,
		`<review_timestamp>2026-05-18T10:30:00Z</review_timestamp>`,
		`<title>Worth the extra</title>`,
		`<content>Cuff is long enough.</content>`,
		`<is_verified_purchase>true</is_verified_purchase>`,
		`<collection_method>post_fulfillment</collection_method>`,
		`<review_url type="singleton">https://www.usetgo.com/products/adult-welding-gloves-4b8866.html</review_url>`,
		`<overall min="1" max="5">5</overall>`,
		`<products>`,
		`<product>`,
		`<product_ids>`,
		`<gtins>`,
		`<gtin>0123456789012</gtin>`,
		`<mpns>`,
		`<mpn>AWG-001</mpn>`,
		`<skus>`,
		`<sku>AWG-001</sku>`,
		`<brands>`,
		`<brand>uSetGo</brand>`,
		`<product_name>Adult Welding Gloves</product_name>`,
		`<product_url>https://www.usetgo.com/products/adult-welding-gloves-4b8866.html</product_url>`,
		`<name is_anonymous="true">Anonymous</name>`,
		`<is_verified_purchase>false</is_verified_purchase>`,
	}
	for _, s := range mustContain {
		if !strings.Contains(xml, s) {
			t.Errorf("expected XML to contain %q\n--- output ---\n%s", s, xml)
		}
	}

	// Must NOT contain (anti-tells)
	mustNotContain := []string{
		`<title></title>`,
		`<favicon></favicon>`,
		`<reviewer is_anonymous="true">`, // attribute on wrong element (must be on <name>)
	}
	for _, s := range mustNotContain {
		if strings.Contains(xml, s) {
			t.Errorf("unexpected substring in XML: %q\n--- output ---\n%s", s, xml)
		}
	}
}

func TestGoogleReviewsFeed_PreflightChecks(t *testing.T) {
	// missing domain
	_, err := buildGoogleReviewsFeed(StorefrontData{
		Company: &storage.CompanyData{Name: "uSetGo"},
	})
	if err == nil {
		t.Error("expected error on missing domain")
	}

	// missing company
	_, err = buildGoogleReviewsFeed(StorefrontData{Domain: "x.com"})
	if err == nil {
		t.Error("expected error on missing company")
	}

	// empty company name
	_, err = buildGoogleReviewsFeed(StorefrontData{
		Domain:  "x.com",
		Company: &storage.CompanyData{Name: "   "},
	})
	if err == nil {
		t.Error("expected error on blank company name")
	}
}

func TestGoogleReviewsFeed_EmptyButValid(t *testing.T) {
	// No products with reviews → empty <feed> but still valid XML.
	// <reviews> element should be omitted entirely (not emitted as empty container).
	out, err := buildGoogleReviewsFeed(StorefrontData{
		Domain:  "www.usetgo.com",
		Company: &storage.CompanyData{Name: "uSetGo"},
	})
	if err != nil {
		t.Fatalf("should not error on empty: %v", err)
	}
	xml := string(out)
	if !strings.Contains(xml, `<version>2.4</version>`) {
		t.Error("version missing from empty feed")
	}
	if !strings.Contains(xml, `<name>uSetGo</name>`) {
		t.Error("publisher missing from empty feed")
	}
	if strings.Contains(xml, `<reviews>`) || strings.Contains(xml, `<reviews/>`) || strings.Contains(xml, `<reviews></reviews>`) {
		t.Errorf("empty feed should omit <reviews> container entirely; got:\n%s", xml)
	}
}

func TestGoogleReviewsFeed_SkipsBadReviews(t *testing.T) {
	data := StorefrontData{
		Domain:  "www.usetgo.com",
		Company: &storage.CompanyData{Name: "uSetGo"},
		Products: []ProductData{
			{
				ID:       "p1",
				Name:     "Test",
				Filename: "test",
				Rating: &Rating{
					Reviews: []Review{
						{Name: "A", Rating: 5, Body: "", Date: time.Now()},     // empty body — skip
						{Name: "B", Rating: 0, Body: "ok", Date: time.Now()},   // bad rating — skip
						{Name: "C", Rating: 6, Body: "ok", Date: time.Now()},   // bad rating — skip
						{Name: "D", Rating: 5, Body: "good", Date: time.Now()}, // keep
					},
				},
			},
		},
	}
	out, _ := buildGoogleReviewsFeed(data)
	xml := string(out)
	if strings.Count(xml, "<review>") != 1 {
		t.Errorf("expected 1 valid review after skipping bad ones, got %d", strings.Count(xml, "<review>"))
	}
}

func TestGoogleReviewsFeed_StableID(t *testing.T) {
	d := time.Date(2026, 5, 18, 10, 30, 0, 0, time.UTC)
	id1 := stableReviewID("p1", "Mark", d, 5)
	id2 := stableReviewID("p1", "Mark", d, 5)
	id3 := stableReviewID("p1", "Mark", d, 4) // different rating
	if id1 != id2 {
		t.Error("same inputs should produce same ID")
	}
	if id1 == id3 {
		t.Error("different rating should produce different ID")
	}
	if len(id1) != 16 {
		t.Errorf("expected 16-char ID, got %d", len(id1))
	}
}

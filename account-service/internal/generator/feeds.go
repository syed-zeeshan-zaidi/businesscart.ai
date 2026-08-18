package generator

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// feedDef describes a shopping channel feed format.
type feedDef struct {
	prefix string // filename prefix: "gs", "fb", etc.
	ext    string // file extension: ".xml", ".csv", ".tsv"
	build  func(StorefrontData) ([]byte, error)
}

// feedRegistry maps channel keys to their definitions.
// To add a new channel: add one build function + one entry here.
var feedRegistry = map[string]feedDef{
	"google":         {"gs", ".xml", buildGoogleFeed},
	"google_reviews": {"gr", ".xml", buildGoogleReviewsFeed},
	"facebook":       {"fb", ".csv", buildFacebookFeed},
	"bing":           {"bg", ".tsv", buildBingFeed},
	"pinterest":      {"pt", ".csv", buildPinterestFeed},
	"tiktok":         {"tt", ".csv", buildTikTokFeed},
}

// FeedFileName returns the unguessable filename for a feed channel.
func FeedFileName(channel, uniqueIdentifier string) string {
	def, ok := feedRegistry[channel]
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s-%s%s", def.prefix, uniqueIdentifier, def.ext)
}

// SupportedFeeds returns the list of valid feed channel keys.
func SupportedFeeds() []string {
	keys := make([]string, 0, len(feedRegistry))
	for k := range feedRegistry {
		keys = append(keys, k)
	}
	return keys
}

// generateFeeds runs after the main storefront is fully generated and uploaded.
// Each feed is isolated — a failure in one never affects the storefront or other feeds.
func (g *Generator) generateFeeds(data StorefrontData, companyDir string) {
	if data.Company == nil || len(data.Company.Feeds) == 0 {
		return
	}

	// Create feeds subdirectory
	feedsDir := filepath.Join(companyDir, "feeds")
	if err := os.MkdirAll(feedsDir, 0755); err != nil {
		log.Printf("[feeds] FAIL: could not create feeds directory: %v", err)
		return
	}

	log.Printf("[feeds] Generating %d feed(s) for %s", len(data.Company.Feeds), data.Company.Name)

	for _, key := range data.Company.Feeds {
		g.generateSingleFeed(key, data, feedsDir)
	}
}

// generateSingleFeed generates one feed in complete isolation.
// Panics are recovered, errors are logged, nothing is propagated.
func (g *Generator) generateSingleFeed(key string, data StorefrontData, feedsDir string) {
	start := time.Now()

	defer func() {
		if r := recover(); r != nil {
			log.Printf("[feed] PANIC: %s feed crashed: %v — storefront unaffected", key, r)
		}
	}()

	def, ok := feedRegistry[key]
	if !ok {
		log.Printf("[feed] SKIP: unknown channel %q", key)
		return
	}

	content, err := def.build(data)
	if err != nil {
		log.Printf("[feed] FAIL: %s — %v", key, err)
		return
	}

	filename := FeedFileName(key, data.Company.UniqueIdentifier)
	feedPath := filepath.Join(feedsDir, filename)
	if err := os.WriteFile(feedPath, content, 0644); err != nil {
		log.Printf("[feed] FAIL: %s write error — %v", key, err)
		return
	}

	log.Printf("[feed] OK: %s → feeds/%s (%d bytes, %dms)", key, filename, len(content), time.Since(start).Milliseconds())
}

// --- Package weight and dimensions (Roadmap #47) ---
//
// Storage is fixed to POUNDS and INCHES, so the unit token is emitted literally.
// Channel support was verified against each spec on 2026-08-10 rather than
// assumed to match Google (per the #45 lesson), and it is NOT uniform:
//
//	Google    shipping_weight + shipping_length/width/height
//	Bing      shipping_weight only  (MMC's product model has no dimension fields)
//	Facebook  shipping_weight only  (dimensions absent from the catalog schema)
//	Pinterest shipping_weight + shipping_width/shipping_height — there is NO length field
//	TikTok    shipping_weight only  (catalog parameter list has no dimension fields)
//
// Google's unit token for dimensions is "in": the help page's units column reads
// "inch", but every example on that page is "20 in" and the Merchant/Content API
// ProductDimension enum is in/cm.
const (
	feedMaxWeightLb = 2000 // Google: 0-2000 lb
	feedMinDimIn    = 1    // Google: 1-150 inch
	feedMaxDimIn    = 150
)

// feedShippingWeight renders "2.5 lb", or "" when absent or outside the
// documented range. An out-of-range value is an item-level error in Merchant
// Center, so omitting one attribute beats getting the product disapproved.
func feedShippingWeight(p ProductData) string {
	if p.Weight <= 0 || p.Weight > feedMaxWeightLb {
		return ""
	}
	return numString(p.Weight) + " lb"
}

// feedShippingDims renders the three package dimensions, or three empty strings.
// ALL THREE must be present and in range or NONE are emitted. Google is explicit
// that without all three "the information can't be used to calculate shipping
// cost", so a partial set is not a partial benefit — it is noise that still
// occupies the attribute.
func feedShippingDims(p ProductData) (length, width, height string) {
	for _, v := range []float64{p.Length, p.Width, p.Height} {
		if v < feedMinDimIn || v > feedMaxDimIn {
			return "", "", ""
		}
	}
	return numString(p.Length) + " in", numString(p.Width) + " in", numString(p.Height) + " in"
}

// --- Custom labels (Roadmap #45) ---
//
// Merchant-set campaign segmentation. All five channels use the IDENTICAL
// custom_label_0..4 naming, verified per spec on 2026-08-10 (Google 1-100 chars,
// Bing 100, Facebook, Pinterest 511, TikTok). The platform caps at Google's 100,
// the strictest, so one value stays valid on every channel.
//
// These are deliberately NOT derived from the product's category: `product_type`
// already carries "Primary > Secondary" and Google Ads can subdivide and report
// on product-type level 1 and level 2 independently, so mirroring the category
// here would burn two of five irreplaceable slots to gain nothing. Custom labels
// exist for groupings that CUT ACROSS the taxonomy (margin tier, price band,
// performance tier), which is exactly what product_type cannot express.

// feedCustomLabels returns the five labels in slot order.
func feedCustomLabels(p ProductData) []string {
	return []string{p.CustomLabel0, p.CustomLabel1, p.CustomLabel2, p.CustomLabel3, p.CustomLabel4}
}

// customLabelHeader renders the five column names joined by sep. Built from the
// same loop as the values so a delimited feed's header and rows cannot drift
// apart in column count.
func customLabelHeader(sep string) string {
	names := make([]string, 5)
	for i := range names {
		names[i] = fmt.Sprintf("custom_label_%d", i)
	}
	return strings.Join(names, sep)
}

// customLabelCols renders the five values as escaped, delimited columns.
func customLabelCols(p ProductData, sep string, escape func(string) string) string {
	cols := feedCustomLabels(p)
	for i, c := range cols {
		cols[i] = escape(c)
	}
	return strings.Join(cols, sep)
}

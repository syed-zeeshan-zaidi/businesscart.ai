package generator

import (
	"business-cart/account-service/internal/storage"
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	texttemplate "text/template"
	"time"
	"unicode"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/cloudfront"
	cftypes "github.com/aws/aws-sdk-go-v2/service/cloudfront/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

//go:embed templates/*
var templatesEmbed embed.FS

type StorefrontData struct {
	AccountID        string // The company's Account _id (hex)
	Company          *storage.CompanyData
	Config           *storage.D2CConfig
	Products         []ProductData
	Categories       []string         // Unique list of product categories
	TopCategories    []string         // Top 6 categories by product count (for footer)
	CategoryCounts   map[string]int   // Product count per category
	FeaturedProducts []ProductData // Subset of products for the homepage
	DealProducts     []ProductData // Products with active deals (DealPrice > 0)
	Year             int
	Timestamp        string
	BasePath         string
	ApiBase          string // Public-facing API URL for browser JS calls
	Domain           string // Pre-computed: CustomDomain if set, else PreviewDomain
}

type Attribute struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type PriceTier struct {
	MinQty int     `json:"minQty"`
	Price  float64 `json:"price"`
}

type ProductData struct {
	ID              string      `json:"_id,omitempty"`
	Name            string      `json:"name"`
	Description     string      `json:"description"`
	Price           float64     `json:"price"`
	DealPrice       float64     `json:"dealPrice,omitempty"`
	DealStartDate   *time.Time  `json:"dealStartDate,omitempty"`
	DealEndDate     *time.Time  `json:"dealEndDate,omitempty"`
	DiscountedPrice float64     `json:"discountedPrice,omitempty"`
	PriceTiers      []PriceTier `json:"priceTiers,omitempty"`
	Images          []string    `json:"images,omitempty"`
	Image           string      `json:"image"`
	Category        string      `json:"category"`
	GoogleProductCategory string `json:"googleProductCategory,omitempty"`
	Slug            string      `json:"slug"`
	SKU             string      `json:"sku,omitempty"`
	Barcode         string      `json:"barcode,omitempty"`
	Stock           int         `json:"stock"`
	Active          *bool       `json:"active,omitempty"`
	Featured        bool        `json:"featured,omitempty"`
	Attributes      []Attribute `json:"attributes"`
	Filename        string      `json:"-"` // Pre-computed: slug-suffix (no extension)
}

type Generator struct {
	TemplateFS     fs.FS
	OutputDir      string
	S3Client       *s3.Client
	BucketName     string
	CFClient       *cloudfront.Client
	DistributionId string
}

func NewGenerator(templateDir, outputDir string, s3Client *s3.Client, bucketName string, cfClient *cloudfront.Client, distributionId string) *Generator {
	var tfs fs.FS
	if templateDir != "" {
		tfs = os.DirFS(templateDir)
	} else {
		// Use embedded templates, rooted at "templates"
		sub, err := fs.Sub(templatesEmbed, "templates")
		if err != nil {
			// fallback (should not happen)
			tfs = templatesEmbed
		} else {
			tfs = sub
		}
	}

	return &Generator{
		TemplateFS:     tfs,
		OutputDir:      outputDir,
		S3Client:       s3Client,
		BucketName:     bucketName,
		CFClient:       cfClient,
		DistributionId: distributionId,
	}
}

func (g *Generator) Generate(data StorefrontData) error {
	companyDir := filepath.Join(g.OutputDir, data.Company.UniqueIdentifier)

	// Clear the directory to ensure old files are removed
	log.Printf("DEBUG: Removing old storefront directory: %s", companyDir)
	if err := os.RemoveAll(companyDir); err != nil {
		log.Printf("ERROR: Failed to remove old storefront directory: %v", err)
		return err
	}

	productsDir := filepath.Join(companyDir, "products")
	if err := os.MkdirAll(productsDir, 0755); err != nil {
		return err
	}

	categoryDir := filepath.Join(companyDir, "category")
	if err := os.MkdirAll(categoryDir, 0755); err != nil {
		return err
	}

	data.Year = time.Now().Year()
	data.Timestamp = time.Now().Format(time.RFC3339)

	// Pre-compute domain for templates
	if data.Config.CustomDomain != "" {
		data.Domain = data.Config.CustomDomain
	} else {
		data.Domain = data.Config.PreviewDomain
	}

	// Pre-compute first image from Images array (if Image not already set)
	for i := range data.Products {
		if data.Products[i].Image == "" && len(data.Products[i].Images) > 0 {
			data.Products[i].Image = data.Products[i].Images[0]
		}
	}

	// Pre-compute product filenames
	for i := range data.Products {
		slug := slugify(data.Products[i].Slug)
		if slug == "" {
			slug = "product"
		}
		suffix := ""
		if len(data.Products[i].ID) > 6 {
			suffix = "-" + data.Products[i].ID[len(data.Products[i].ID)-6:]
		}
		data.Products[i].Filename = slug + suffix
	}

	// Extract Categories with counts (normalize "Gloves/BBQ" → "Gloves / BBQ")
	categoryCounts := make(map[string]int)
	for i, p := range data.Products {
		if p.Category != "" {
			primary, sub := parseCategoryParts(p.Category)
			normalized := primary
			if sub != "" {
				normalized = primary + " / " + sub
			}
			data.Products[i].Category = normalized // normalize on product too
			categoryCounts[normalized]++
		}
	}
	data.CategoryCounts = categoryCounts
	for cat := range categoryCounts {
		data.Categories = append(data.Categories, cat)
	}

	// Top primary categories by product count (for footer — max 6)
	primaryCounts := map[string]int{}
	for _, cat := range data.Categories {
		p, _ := parseCategoryParts(cat)
		primaryCounts[p] += categoryCounts[cat]
	}
	var primaries []string
	for p := range primaryCounts {
		primaries = append(primaries, p)
	}
	sort.Slice(primaries, func(i, j int) bool {
		return primaryCounts[primaries[i]] > primaryCounts[primaries[j]]
	})
	if len(primaries) > 6 {
		data.TopCategories = primaries[:6]
	} else {
		data.TopCategories = primaries
	}

	// Featured products: use products marked as featured, fallback to first 3
	for _, p := range data.Products {
		if p.Featured {
			data.FeaturedProducts = append(data.FeaturedProducts, p)
		}
	}
	if len(data.FeaturedProducts) == 0 {
		if len(data.Products) > 3 {
			data.FeaturedProducts = data.Products[:3]
		} else {
			data.FeaturedProducts = data.Products
		}
	}

	// Deal products: products with active deals (DealPrice > 0, within date range if set)
	now := time.Now()
	for _, p := range data.Products {
		if p.DealPrice > 0 {
			if p.DealStartDate != nil && p.DealStartDate.After(now) {
				continue
			}
			if p.DealEndDate != nil && p.DealEndDate.Before(now) {
				continue
			}
			data.DealProducts = append(data.DealProducts, p)
		}
	}

	// Generate Index HTML
	if err := g.renderTemplate(
		"index.html",
		filepath.Join(companyDir, "index.html"),
		data,
		true,
	); err != nil {
		return err
	}

	// Generate Index MD
	if err := g.renderTemplate(
		"index.md",
		filepath.Join(companyDir, "index.md"),
		data,
		false,
	); err != nil {
		return err
	}

	// Generate All Products HTML
	if err := g.renderTemplate(
		"products.html",
		filepath.Join(companyDir, "products.html"),
		data,
		true,
	); err != nil {
		return fmt.Errorf("products.html: %w", err)
	}

	// Generate Deals Page (only if there are deals)
	if len(data.DealProducts) > 0 {
		if err := g.renderTemplate(
			"deals.html",
			filepath.Join(companyDir, "deals.html"),
			data,
			true,
		); err != nil {
			return fmt.Errorf("deals.html: %w", err)
		}
	}

	// Generate Contact Page
	if err := g.renderTemplate("contact.html", filepath.Join(companyDir, "contact.html"), data, true); err != nil {
		return fmt.Errorf("contact.html: %w", err)
	}

	// Generate Privacy Policy Page
	if err := g.renderTemplate("privacy.html", filepath.Join(companyDir, "privacy.html"), data, true); err != nil {
		return fmt.Errorf("privacy.html: %w", err)
	}

	// Generate Terms of Service Page
	if err := g.renderTemplate("terms.html", filepath.Join(companyDir, "terms.html"), data, true); err != nil {
		return fmt.Errorf("terms.html: %w", err)
	}

	// Generate Shipping & Returns Page
	if err := g.renderTemplate("shipping.html", filepath.Join(companyDir, "shipping.html"), data, true); err != nil {
		return fmt.Errorf("shipping.html: %w", err)
	}

	// Generate About Page (only if aboutText is configured)
	if data.Config != nil && data.Config.AboutText != "" {
		if err := g.renderTemplate("about.html", filepath.Join(companyDir, "about.html"), data, true); err != nil {
			return fmt.Errorf("about.html: %w", err)
		}
	}

	// Generate Category Pages (with primary/sub hierarchy)
	// Group categories by primary name
	primaryToRaw := map[string][]string{}
	for _, cat := range data.Categories {
		p, _ := parseCategoryParts(cat)
		primaryToRaw[p] = append(primaryToRaw[p], cat)
	}

	buildCatData := func(category string, products []ProductData, isPrimary bool, primaryName, subName string) interface{} {
		return struct {
			AccountID      string
			Company        *storage.CompanyData
			Config         *storage.D2CConfig
			Category       string
			IsPrimary      bool
			PrimaryName    string
			SubName        string
			Products       []ProductData
			DealProducts   []ProductData
			Year           int
			Timestamp      string
			Categories     []string
			TopCategories  []string
			CategoryCounts map[string]int
			BasePath       string
			ApiBase        string
			Domain         string
		}{
			AccountID:      data.AccountID,
			Company:        data.Company,
			Config:         data.Config,
			Category:       category,
			IsPrimary:      isPrimary,
			PrimaryName:    primaryName,
			SubName:        subName,
			Products:       products,
			DealProducts:   data.DealProducts,
			Year:           data.Year,
			Timestamp:      data.Timestamp,
			Categories:     data.Categories,
			TopCategories:  data.TopCategories,
			CategoryCounts: data.CategoryCounts,
			BasePath:       "../",
			ApiBase:        data.ApiBase,
			Domain:         data.Domain,
		}
	}

	for primary, rawCats := range primaryToRaw {
		hasSubs := false
		for _, rc := range rawCats {
			if _, s := parseCategoryParts(rc); s != "" {
				hasSubs = true
				break
			}
		}

		if !hasSubs {
			// Standalone category (no slash) — single page, same as before
			var products []ProductData
			for _, p := range data.Products {
				if p.Category == rawCats[0] {
					products = append(products, p)
				}
			}
			filename := slugify(primary) + ".html"
			if err := g.renderTemplate("category.html", filepath.Join(categoryDir, filename),
				buildCatData(primary, products, false, primary, ""), true); err != nil {
				return fmt.Errorf("category %s: %w", primary, err)
			}
		} else {
			// Has subs — generate primary page (all products) + individual sub pages
			var allProducts []ProductData
			for _, p := range data.Products {
				pp, _ := parseCategoryParts(p.Category)
				if pp == primary {
					allProducts = append(allProducts, p)
				}
			}
			primaryFilename := slugify(primary) + ".html"
			if err := g.renderTemplate("category.html", filepath.Join(categoryDir, primaryFilename),
				buildCatData(primary, allProducts, true, primary, ""), true); err != nil {
				return fmt.Errorf("category %s: %w", primary, err)
			}

			// Generate sub-category pages
			for _, rawCat := range rawCats {
				_, sub := parseCategoryParts(rawCat)
				if sub == "" {
					continue
				}
				var subProducts []ProductData
				for _, p := range data.Products {
					if p.Category == rawCat {
						subProducts = append(subProducts, p)
					}
				}
				subFilename := slugify(primary) + "-" + slugify(sub) + ".html"
				if err := g.renderTemplate("category.html", filepath.Join(categoryDir, subFilename),
					buildCatData(sub, subProducts, false, primary, sub), true); err != nil {
					return fmt.Errorf("category %s/%s: %w", primary, sub, err)
				}
			}
		}
	}

	// Generate individual Product pages
	for _, product := range data.Products {
		filenameBase := product.Filename

		// Related products: same category, exclude current, max 4
		var related []ProductData
		for _, p := range data.Products {
			if p.ID != product.ID && p.Category == product.Category {
				related = append(related, p)
				if len(related) >= 4 {
					break
				}
			}
		}

		productPageData := struct {
			AccountID       string
			Company         *storage.CompanyData
			Config          *storage.D2CConfig
			Product         ProductData
			RelatedProducts []ProductData
			DealProducts    []ProductData
			Year            int
			Timestamp       string
			Categories      []string
			TopCategories   []string
			CategoryCounts  map[string]int
			BasePath        string
			ApiBase         string
			Domain          string
		}{
			AccountID:       data.AccountID,
			Company:         data.Company,
			Config:          data.Config,
			Product:         product,
			RelatedProducts: related,
			DealProducts:    data.DealProducts,
			Year:            data.Year,
			Timestamp:       data.Timestamp,
			Categories:      data.Categories,
			TopCategories:   data.TopCategories,
			CategoryCounts:  data.CategoryCounts,
			BasePath:        "../",
			ApiBase:         data.ApiBase,
			Domain:          data.Domain,
		}

		// Product HTML
		if err := g.renderTemplate(
			"product.html",
			filepath.Join(productsDir, filenameBase+".html"),
			productPageData,
			true,
		); err != nil {
			return err
		}

		// Product MD
		if err := g.renderTemplate(
			"product.md",
			filepath.Join(productsDir, filenameBase+".md"),
			productPageData,
			false,
		); err != nil {
			return err
		}
	}

	// Generate Products MD (full catalog)
	if err := g.renderTemplate(
		"products.md",
		filepath.Join(companyDir, "products.md"),
		data,
		false,
	); err != nil {
		return fmt.Errorf("products.md: %w", err)
	}

	// Generate robots.txt
	if err := g.renderTemplate(
		"robots.txt",
		filepath.Join(companyDir, "robots.txt"),
		data,
		false,
	); err != nil {
		return fmt.Errorf("robots.txt: %w", err)
	}

	// Generate sitemap.xml
	if err := g.renderTemplate(
		"sitemap.xml",
		filepath.Join(companyDir, "sitemap.xml"),
		data,
		false,
	); err != nil {
		return fmt.Errorf("sitemap.xml: %w", err)
	}

	// Generate llms.txt
	if err := g.renderTemplate(
		"llms.txt",
		filepath.Join(companyDir, "llms.txt"),
		data,
		false,
	); err != nil {
		return fmt.Errorf("llms.txt: %w", err)
	}

	// Copy Static Files
	for _, jsFile := range []string{"tracker.js", "cart.js", "customer.js", "nav.js"} {
		jsData, err := fs.ReadFile(g.TemplateFS, jsFile)
		if err != nil {
			return fmt.Errorf("%s read: %w", jsFile, err)
		}
		if err := os.WriteFile(filepath.Join(companyDir, jsFile), jsData, 0644); err != nil {
			return fmt.Errorf("%s write: %w", jsFile, err)
		}
	}

	// Shopping channel feeds — isolated, never breaks storefront
	g.generateFeeds(data, companyDir)

	// Delete old S3 files before uploading fresh set
	if err := g.DeleteStorefront(data.Company.UniqueIdentifier); err != nil {
		log.Printf("WARN: failed to clean old S3 files: %v", err)
	}

	return g.syncToS3(companyDir, data.Company.UniqueIdentifier)
}

func (g *Generator) DeleteStorefront(companyUID string) error {
	if g.S3Client == nil || g.BucketName == "" || companyUID == "" {
		return nil
	}

	prefix := "storefronts/" + companyUID + "/"

	// List all objects with the prefix
	listOutput, err := g.S3Client.ListObjectsV2(context.TODO(), &s3.ListObjectsV2Input{
		Bucket: aws.String(g.BucketName),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return err
	}

	if len(listOutput.Contents) == 0 {
		return nil
	}

	// Prepare delete objects
	var identifiers []types.ObjectIdentifier
	for _, obj := range listOutput.Contents {
		identifiers = append(identifiers, types.ObjectIdentifier{
			Key: obj.Key,
		})
	}

	_, err = g.S3Client.DeleteObjects(context.TODO(), &s3.DeleteObjectsInput{
		Bucket: aws.String(g.BucketName),
		Delete: &types.Delete{
			Objects: identifiers,
		},
	})

	return err
}

func (g *Generator) syncToS3(localDir, companyUID string) error {
	if g.S3Client == nil || g.BucketName == "" || os.Getenv("NODE_ENV") == "local" {
		return nil // Skip if not configured or local
	}

	return filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}

		relPath, _ := filepath.Rel(localDir, path)
		s3Key := "storefronts/" + companyUID + "/" + relPath

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = g.S3Client.PutObject(context.TODO(), &s3.PutObjectInput{
			Bucket:       aws.String(g.BucketName),
			Key:          aws.String(s3Key),
			Body:         file,
			ContentType:  aws.String(g.getContentType(path)),
			CacheControl: aws.String(g.getCacheControl(path)),
		})
		return err
	})
}

func (g *Generator) getCacheControl(path string) string {
	switch filepath.Ext(path) {
	case ".js":
		return "public, max-age=604800" // 7 days — JS changes only on code deploy
	default:
		return "public, max-age=3600" // 1 hour — HTML/MD/XML change with product updates
	}
}

func (g *Generator) InvalidateCache(companyUID string) error {
	if g.CFClient == nil || g.DistributionId == "" {
		return nil // skip in local dev
	}
	_, err := g.CFClient.CreateInvalidation(context.TODO(), &cloudfront.CreateInvalidationInput{
		DistributionId: aws.String(g.DistributionId),
		InvalidationBatch: &cftypes.InvalidationBatch{
			CallerReference: aws.String(fmt.Sprintf("%s-%d", companyUID, time.Now().Unix())),
			Paths: &cftypes.Paths{
				Quantity: aws.Int32(1),
				Items:    []string{"/storefronts/" + companyUID + "/*"},
			},
		},
	})
	if err != nil {
		log.Printf("CloudFront invalidation failed for %s: %v", companyUID, err)
	}
	return err
}

func (g *Generator) getContentType(path string) string {
	switch filepath.Ext(path) {
	case ".html":
		return "text/html; charset=utf-8"
	case ".md":
		return "text/markdown; charset=utf-8"
	case ".js":
		return "application/javascript"
	case ".xml":
		return "application/xml"
	case ".txt":
		return "text/plain; charset=utf-8"
	default:
		return "application/octet-stream"
	}
}

func (g *Generator) renderTemplate(tmplName, outputPath string, data interface{}, isHTML bool) error {
	content, err := fs.ReadFile(g.TemplateFS, tmplName)
	if err != nil {
		return err
	}

	sanitizedContent := ""
	if isHTML {
		partials, err := fs.ReadFile(g.TemplateFS, "partials.html")
		if err == nil {
			sanitizedContent += g.sanitizeTemplate(string(partials)) + "\n"
		}
	}
	sanitizedContent += g.sanitizeTemplate(string(content))

	var buf bytes.Buffer
	paymentLabels := map[string]string{
		"credit_card": "Credit Card", "purchase_order": "Purchase Order",
		"amazon_pay": "Amazon Pay", "google_pay": "Google Pay", "stripe_pay": "Credit Card",
		"pickup_&_pay": "Pay at Pickup", "deliver_pay": "Pay on Delivery",
	}
	deliveryLabels := map[string]string{
		"pickup": "Pickup", "dropoff": "Local Delivery", "shipping_out": "Shipping",
	}

	funcMap := template.FuncMap{
		"subtract": func(a, b int) int { return a - b },
		"printf":   fmt.Sprintf,
		"slugify":  slugify,
		"jsArray": func(v interface{}) template.JS {
			b, _ := json.Marshal(v)
			return template.JS(b)
		},
		"paymentLabel": func(s string) string {
			if l, ok := paymentLabels[s]; ok {
				return l
			}
			return s
		},
		"deliveryLabel": func(s string) string {
			if l, ok := deliveryLabels[s]; ok {
				return l
			}
			return s
		},
		"isOnlinePayment": func(s string) bool {
			return s == "credit_card" || s == "amazon_pay" || s == "google_pay" || s == "stripe_pay"
		},
		"savingsPercent": func(original, discounted float64) int {
			if original <= 0 {
				return 0
			}
			return int(((original - discounted) / original) * 100)
		},
		"subtractFloat": func(a, b float64) float64 { return a - b },
		"primaryOf": func(cat string) string {
			p, _ := parseCategoryParts(cat)
			return p
		},
		"subOf": func(cat string) string {
			_, s := parseCategoryParts(cat)
			return s
		},
		"uniquePrimaries": func(categories []string) []string {
			seen := map[string]bool{}
			var result []string
			for _, cat := range categories {
				p, _ := parseCategoryParts(cat)
				if !seen[p] {
					seen[p] = true
					result = append(result, p)
				}
			}
			return result
		},
		"subsOf": func(categories []string, primary string) []string {
			var subs []string
			for _, cat := range categories {
				p, s := parseCategoryParts(cat)
				if p == primary && s != "" {
					subs = append(subs, s)
				}
			}
			return subs
		},
		"primaryCount": func(categories []string, counts map[string]int, primary string) int {
			total := 0
			for _, cat := range categories {
				p, _ := parseCategoryParts(cat)
				if p == primary {
					total += counts[cat]
				}
			}
			return total
		},
		"catSlug": func(primary, sub string) string {
			if sub == "" {
				return slugify(primary)
			}
			return slugify(primary) + "-" + slugify(sub)
		},
		"safeHTML": func(s string) template.HTML {
			// Allowlist: escape EVERYTHING, then re-allow a tiny set of
			// formatting tags. Attributes are never allowed (no <a href>,
			// no onclick/onerror, no style). This is rendered into
			// company-controlled marketing pages (about/privacy/terms/
			// shipping) where the operator wants light formatting only.
			esc := template.HTMLEscapeString(s)
			tags := []string{"p", "br", "strong", "em", "ul", "li", "h2"}
			for _, t := range tags {
				esc = strings.ReplaceAll(esc, "&lt;"+t+"&gt;", "<"+t+">")
				esc = strings.ReplaceAll(esc, "&lt;/"+t+"&gt;", "</"+t+">")
			}
			esc = strings.ReplaceAll(esc, "&lt;br/&gt;", "<br/>")
			esc = strings.ReplaceAll(esc, "&lt;br /&gt;", "<br />")
			return template.HTML(esc)
		},
		"catCount": func(counts map[string]int, cat string) int {
			return counts[cat]
		},
	}

	if isHTML {
		// Use custom [[ ]] delimiters to avoid conflict with CSS auto-formatters
		tmpl, err := template.New(tmplName).Delims("[[", "]]").Funcs(funcMap).Parse(sanitizedContent)
		if err != nil {
			log.Printf("ERROR: Failed to parse HTML template %s: %v", tmplName, err)
			return err
		}
		if err := tmpl.Execute(&buf, data); err != nil {
			return err
		}
	} else {
		// Also use custom [[ ]] for text templates
		tmpl, err := texttemplate.New(tmplName).Delims("[[", "]]").Funcs(texttemplate.FuncMap{
			"subtract": func(a, b int) int { return a - b },
			"printf":   fmt.Sprintf,
			"slugify":  slugify,
		}).Parse(sanitizedContent)
		if err != nil {
			log.Printf("ERROR: Failed to parse Text template %s: %v", tmplName, err)
			return err
		}
		if err := tmpl.Execute(&buf, data); err != nil {
			return err
		}
	}

	return os.WriteFile(outputPath, buf.Bytes(), 0644)
}

// slugify converts a string to a URL-safe lowercase slug.
// parseCategoryParts splits "Gloves / BBQ" → ("Gloves", "BBQ"). No slash → ("Gardening Gloves", "").
func parseCategoryParts(raw string) (primary, sub string) {
	parts := strings.SplitN(raw, "/", 2)
	primary = strings.TrimSpace(parts[0])
	if len(parts) > 1 {
		sub = strings.TrimSpace(parts[1])
	}
	// Edge cases: "/ BBQ" or "Gloves /" — treat non-empty part as primary
	if primary == "" && sub != "" {
		primary = sub
		sub = ""
	}
	if primary == "" {
		primary = strings.TrimSpace(raw)
	}
	return
}

func slugify(s string) string {
	var b strings.Builder
	prev := false
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			prev = false
		} else if !prev && b.Len() > 0 {
			b.WriteByte('-')
			prev = true
		}
	}
	return strings.TrimRight(b.String(), "-")
}

// sanitizeTemplate uses regex to fix common "mangling" by auto-formatters.
func (g *Generator) sanitizeTemplate(content string) string {
	// Fix broken [[ tags: "[ [" or "[  [" -> "[["
	reOpenBracket := regexp.MustCompile(`\[\s+\[`)
	content = reOpenBracket.ReplaceAllString(content, "[[")

	// Fix broken ]] tags: "] ]" or "]  ]" -> "]]"
	reCloseBracket := regexp.MustCompile(`\]\s+\]`)
	content = reCloseBracket.ReplaceAllString(content, "]]")

	return content
}

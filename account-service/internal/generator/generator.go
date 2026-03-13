package generator

import (
	"business-cart/account-service/internal/storage"
	"bytes"
	"context"
	"embed"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	texttemplate "text/template"
	"time"
	"unicode"

	"github.com/aws/aws-sdk-go-v2/aws"
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
	Categories       []string      // Unique list of product categories
	FeaturedProducts []ProductData // Subset of products for the homepage
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

type ProductData struct {
	ID              string      `json:"_id,omitempty"`
	Name            string      `json:"name"`
	Description     string      `json:"description"`
	Price           float64     `json:"price"`
	DealPrice       float64     `json:"dealPrice,omitempty"`
	DiscountedPrice float64     `json:"discountedPrice,omitempty"`
	Images          []string    `json:"images,omitempty"`
	Image           string      `json:"image"`
	Category        string      `json:"category"`
	Slug            string      `json:"slug"`
	Attributes      []Attribute `json:"attributes"`
	Filename        string      `json:"-"` // Pre-computed: slug-suffix (no extension)
}

type Generator struct {
	TemplateFS fs.FS
	OutputDir  string
	S3Client   *s3.Client
	BucketName string
}

func NewGenerator(templateDir, outputDir string, s3Client *s3.Client, bucketName string) *Generator {
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
		TemplateFS: tfs,
		OutputDir:  outputDir,
		S3Client:   s3Client,
		BucketName: bucketName,
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
		slug := data.Products[i].Slug
		if slug == "" {
			slug = "product"
		}
		suffix := ""
		if len(data.Products[i].ID) > 6 {
			suffix = "-" + data.Products[i].ID[len(data.Products[i].ID)-6:]
		}
		data.Products[i].Filename = slug + suffix
	}

	// Extract Categories and Featured Products
	categoryMap := make(map[string]bool)
	for _, p := range data.Products {
		if p.Category != "" {
			categoryMap[p.Category] = true
		}
	}
	for cat := range categoryMap {
		data.Categories = append(data.Categories, cat)
	}

	// Simple selection for featured products (e.g., first 8)
	if len(data.Products) > 8 {
		data.FeaturedProducts = data.Products[:8]
	} else {
		data.FeaturedProducts = data.Products
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

	// Generate Category Pages
	for _, cat := range data.Categories {
		var catProducts []ProductData
		for _, p := range data.Products {
			if p.Category == cat {
				catProducts = append(catProducts, p)
			}
		}

		catData := struct {
			AccountID string
			Company   *storage.CompanyData
			Config    *storage.D2CConfig
			Category  string
			Products  []ProductData
			Year      int
			Timestamp string
			// Also passing the full list of categories for the nav menu
			Categories []string
			BasePath   string
			ApiBase    string
			Domain     string
		}{
			AccountID:  data.AccountID,
			Company:    data.Company,
			Config:     data.Config,
			Category:   cat,
			Products:   catProducts,
			Year:       data.Year,
			Timestamp:  data.Timestamp,
			Categories: data.Categories,
			BasePath:   "../",
			ApiBase:    data.ApiBase,
			Domain:     data.Domain,
		}

		catFilename := fmt.Sprintf("%s.html", slugify(cat))

		if err := g.renderTemplate(
			"category.html",
			filepath.Join(categoryDir, catFilename),
			catData,
			true,
		); err != nil {
			return fmt.Errorf("category %s: %w", cat, err)
		}
	}

	// Generate individual Product pages
	for _, product := range data.Products {
		filenameBase := product.Filename

		productPageData := struct {
			AccountID  string
			Company    *storage.CompanyData
			Config     *storage.D2CConfig
			Product    ProductData
			Year       int
			Timestamp  string
			Categories []string
			BasePath   string
			ApiBase    string
			Domain     string
		}{
			AccountID:  data.AccountID,
			Company:    data.Company,
			Config:     data.Config,
			Product:    product,
			Year:       data.Year,
			Timestamp:  data.Timestamp,
			Categories: data.Categories,
			BasePath:   "../",
			ApiBase:    data.ApiBase,
			Domain:     data.Domain,
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
	for _, jsFile := range []string{"cart.js", "customer.js", "nav.js"} {
		jsData, err := fs.ReadFile(g.TemplateFS, jsFile)
		if err != nil {
			return fmt.Errorf("%s read: %w", jsFile, err)
		}
		if err := os.WriteFile(filepath.Join(companyDir, jsFile), jsData, 0644); err != nil {
			return fmt.Errorf("%s write: %w", jsFile, err)
		}
	}

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
			Bucket: aws.String(g.BucketName),
			Key:    aws.String(s3Key),
			Body:   file,
			// Simplified content-type logic
			ContentType: aws.String(g.getContentType(path)),
		})
		return err
	})
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
	funcMap := template.FuncMap{
		"subtract": func(a, b int) int { return a - b },
		"printf":   fmt.Sprintf,
		"slugify":  slugify,
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

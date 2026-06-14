package generator

import (
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"business-cart/account-service/internal/storage"
)

// generateBlog renders all blog templates for a company. Isolated step —
// any failure here logs and returns; never affects product pages or feeds.
//
// Output structure:
//
//	{companyDir}/blog/index.html              - all posts listing
//	{companyDir}/blog/category/{slug}.html    - per-category listing
//	{companyDir}/blog/{filename}.html         - individual post
//	{companyDir}/blog/{filename}.md           - LLM companion file
//	{companyDir}/blog/feed.xml                - RSS feed
//
// Filename pattern matches products: {slug}-{last6charsOfID}.
func (g *Generator) generateBlog(data StorefrontData, companyDir string) {
	if len(data.BlogPosts) == 0 {
		return
	}

	blogDir := filepath.Join(companyDir, "blog")
	if err := os.MkdirAll(blogDir, 0755); err != nil {
		log.Printf("[blog] FAIL: mkdir %s: %v", blogDir, err)
		return
	}
	blogCatDir := filepath.Join(blogDir, "category")
	if err := os.MkdirAll(blogCatDir, 0755); err != nil {
		log.Printf("[blog] FAIL: mkdir %s: %v", blogCatDir, err)
		return
	}

	// Posts already filtered + filename-computed in Generate(). Sort newest first.
	active := make([]BlogPostData, len(data.BlogPosts))
	copy(active, data.BlogPosts)
	sort.Slice(active, func(i, j int) bool {
		return active[i].PublishedAt.After(active[j].PublishedAt)
	})
	cats := data.BlogCategories

	// --- Individual post pages + .md companions ---
	for _, post := range active {
		// Related posts: same category, exclude current, max 3.
		var related []BlogPostData
		for _, rp := range active {
			if rp.ID != post.ID && rp.Category == post.Category {
				related = append(related, rp)
				if len(related) >= 3 {
					break
				}
			}
		}

		postPageData := struct {
			AccountID      string
			Company        *storage.CompanyData
			Config         *storage.D2CConfig
			Post           BlogPostData
			RelatedPosts   []BlogPostData
			DealProducts   []ProductData
			Categories     []string
			TopCategories  []string
			CategoryCounts map[string]int
			BlogCategories []string
			HasBlog        bool
			Year           int
			Timestamp      string
			BasePath       string
			ApiBase        string
			Domain         string
		}{
			AccountID:      data.AccountID,
			Company:        data.Company,
			Config:         data.Config,
			Post:           post,
			RelatedPosts:   related,
			DealProducts:   data.DealProducts,
			Categories:     data.Categories,
			TopCategories:  data.TopCategories,
			CategoryCounts: data.CategoryCounts,
			BlogCategories: cats,
			HasBlog:        data.HasBlog,
			Year:           data.Year,
			Timestamp:      data.Timestamp,
			BasePath:       "../",
			ApiBase:        data.ApiBase,
			Domain:         data.Domain,
		}

		if err := g.renderTemplate(
			"blog-post.html",
			filepath.Join(blogDir, post.Filename+".html"),
			postPageData,
			true,
		); err != nil {
			log.Printf("[blog] FAIL: post html %s: %v", post.Slug, err)
			continue
		}
		if err := g.renderTemplate(
			"blog-post.md",
			filepath.Join(blogDir, post.Filename+".md"),
			postPageData,
			false,
		); err != nil {
			log.Printf("[blog] FAIL: post md %s: %v", post.Slug, err)
		}
	}

	// --- Per-category pages ---
	for _, cat := range cats {
		var inCat []BlogPostData
		for _, p := range active {
			if p.Category == cat {
				inCat = append(inCat, p)
			}
		}
		catData := struct {
			AccountID      string
			Company        *storage.CompanyData
			Config         *storage.D2CConfig
			Category       string
			Posts          []BlogPostData
			BlogCategories []string
			HasBlog        bool
			DealProducts   []ProductData
			Categories     []string
			TopCategories  []string
			CategoryCounts map[string]int
			Year           int
			Timestamp      string
			BasePath       string
			Domain         string
		}{
			AccountID:      data.AccountID,
			Company:        data.Company,
			Config:         data.Config,
			Category:       cat,
			Posts:          inCat,
			BlogCategories: cats,
			HasBlog:        data.HasBlog,
			DealProducts:   data.DealProducts,
			Categories:     data.Categories,
			TopCategories:  data.TopCategories,
			CategoryCounts: data.CategoryCounts,
			Year:           data.Year,
			Timestamp:      data.Timestamp,
			BasePath:       "../../",
			Domain:         data.Domain,
		}
		if err := g.renderTemplate(
			"blog-category.html",
			filepath.Join(blogCatDir, slugify(cat)+".html"),
			catData,
			true,
		); err != nil {
			log.Printf("[blog] FAIL: category %s: %v", cat, err)
		}
	}

	// --- Index page (all posts) ---
	indexData := struct {
		AccountID      string
		Company        *storage.CompanyData
		Config         *storage.D2CConfig
		Posts          []BlogPostData
		BlogCategories []string
		HasBlog        bool
		DealProducts   []ProductData
		Categories     []string
		TopCategories  []string
		CategoryCounts map[string]int
		Year           int
		Timestamp      string
		BasePath       string
		Domain         string
	}{
		AccountID:      data.AccountID,
		Company:        data.Company,
		Config:         data.Config,
		Posts:          active,
		BlogCategories: cats,
		HasBlog:        data.HasBlog,
		DealProducts:   data.DealProducts,
		Categories:     data.Categories,
		TopCategories:  data.TopCategories,
		CategoryCounts: data.CategoryCounts,
		Year:           data.Year,
		Timestamp:      data.Timestamp,
		BasePath:       "../",
		Domain:         data.Domain,
	}
	if err := g.renderTemplate(
		"blog-index.html",
		filepath.Join(blogDir, "index.html"),
		indexData,
		true,
	); err != nil {
		log.Printf("[blog] FAIL: index: %v", err)
	}

	log.Printf("[blog] OK: %d posts, %d categories rendered", len(active), len(cats))
}

// stripScriptsAndHandlers removes <script>...</script> blocks and any
// on*="..." event handler attributes. Defense-in-depth XSS hardening for
// admin-authored blog HTML — does NOT sanitize all attack vectors, just
// the worst-class ones. Trust model is the same as product descriptions.
func stripScriptsAndHandlers(s string) string {
	out := s
	// Strip <script>...</script> (case-insensitive, multiline-aware).
	for {
		lo := strings.Index(strings.ToLower(out), "<script")
		if lo < 0 {
			break
		}
		hi := strings.Index(strings.ToLower(out[lo:]), "</script>")
		if hi < 0 {
			// Unterminated — drop the tail to be safe.
			out = out[:lo]
			break
		}
		out = out[:lo] + out[lo+hi+len("</script>"):]
	}
	// Strip on*="..." and on*='...' event handlers.
	out = stripEventHandlers(out)
	return out
}

// stripEventHandlers walks the string once, removing any `on[a-z]+="..."` or
// `on[a-z]+='...'` attribute occurrences. Plain linear scan, no regex dep.
func stripEventHandlers(s string) string {
	var b strings.Builder
	i := 0
	for i < len(s) {
		// Look for whitespace followed by "on"
		if i+3 < len(s) && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n') &&
			(s[i+1] == 'o' || s[i+1] == 'O') && (s[i+2] == 'n' || s[i+2] == 'N') {
			// Scan attribute name (letters)
			j := i + 3
			for j < len(s) && ((s[j] >= 'a' && s[j] <= 'z') || (s[j] >= 'A' && s[j] <= 'Z')) {
				j++
			}
			// Expect '=' next
			if j < len(s) && s[j] == '=' {
				j++
				// Quoted value
				if j < len(s) && (s[j] == '"' || s[j] == '\'') {
					quote := s[j]
					j++
					for j < len(s) && s[j] != quote {
						j++
					}
					if j < len(s) {
						j++ // consume closing quote
					}
					i = j
					continue
				}
			}
		}
		b.WriteByte(s[i])
		i++
	}
	return b.String()
}

// countWords is an estimate based on whitespace splits; sufficient for "X min read".
// Strips simple HTML tags before counting so markup doesn't inflate the count.
func countWords(s string) int {
	// Cheap tag strip: replace anything between < and > with a space.
	var b strings.Builder
	inTag := false
	for _, r := range s {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
			b.WriteRune(' ')
		case !inTag:
			b.WriteRune(r)
		}
	}
	fields := strings.Fields(b.String())
	return len(fields)
}

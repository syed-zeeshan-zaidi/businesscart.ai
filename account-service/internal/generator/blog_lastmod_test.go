package generator

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"business-cart/account-service/internal/storage"
)

// A post that has been PUBLISHED but never edited: PublishedAt set, UpdatedAt zero.
func TestBlogPostPublishedButNeverEditedKeepsLastmod(t *testing.T) {
	active := true
	dir := t.TempDir()
	g := NewGenerator("", dir, nil, "", nil, "")
	if err := g.Generate(StorefrontData{
		AccountID: "a",
		Company:   &storage.CompanyData{Name: "Co", UniqueIdentifier: "bd"},
		Config:    &storage.D2CConfig{Enabled: true},
		Products: []ProductData{{ID: "p", Name: "P", Slug: "p", Category: "Cat", Price: 1,
			Description: "d", UpdatedAt: time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)}},
		BlogPosts: []BlogPostData{{
			ID: "b1", Title: "Never Edited", Slug: "never-edited", Category: "News",
			Body: "body", Active: &active,
			PublishedAt: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC),
			// UpdatedAt deliberately zero.
		}},
		HasBlog: true,
	}); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(dir, "bd", "sitemap.xml"))
	sm := string(b)
	// Scoped to the POST's own <url> block. Asserting on the whole document
	// passed on the blog index and category entries, which carry the same date,
	// and so missed that the post itself had none.
	start := strings.Index(sm, "/blog/never-edited.html")
	if start < 0 {
		t.Fatal("the post is not in the sitemap at all")
	}
	end := strings.Index(sm[start:], "</url>")
	if end < 0 {
		t.Fatal("malformed sitemap entry")
	}
	block := sm[start : start+end]
	if !strings.Contains(block, "<lastmod>2026-06-01T10:00:00Z</lastmod>") {
		t.Fatalf("a published post that was never edited has no lastmod of its own:\n%s", block)
	}
}

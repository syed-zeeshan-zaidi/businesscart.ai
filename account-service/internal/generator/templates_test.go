package generator

import (
	htmltemplate "html/template"
	"io/fs"
	"path"
	"sort"
	"testing"
	texttemplate "text/template"
)

// TestAllTemplatesParse parses every embedded template the same way
// renderTemplate() does at runtime, so syntax errors fail in CI instead of
// surfacing only when a storefront regen is attempted.
func TestAllTemplatesParse(t *testing.T) {
	g := NewGenerator("", "", nil, "", nil, "")

	nopAny := func(args ...interface{}) interface{} { return "" }

	htmlFuncNames := []string{
		"subtract", "printf", "slugify", "jsArray", "paymentLabel", "deliveryLabel",
		"isOnlinePayment", "savingsPercent", "subtractFloat", "primaryOf", "subOf",
		"uniquePrimaries", "subsOf", "primaryCount", "catSlug", "rawHTML", "safeHTML",
		"catCount", "stars", "distPct", "reviewsJSONLD", "distCount", "lastmod",
		"dims", "num", "faqJSONLD",
	}
	htmlFuncs := htmltemplate.FuncMap{}
	for _, n := range htmlFuncNames {
		htmlFuncs[n] = nopAny
	}

	textFuncs := texttemplate.FuncMap{
		"subtract": nopAny,
		"printf":   nopAny,
		"slugify":  nopAny,
		"lastmod":  nopAny,
		"dims":     nopAny,
		"num":      nopAny,
	}

	partials, err := fs.ReadFile(g.TemplateFS, "partials.html")
	if err != nil {
		t.Fatalf("read partials.html: %v", err)
	}
	partialsSan := g.sanitizeTemplate(string(partials))

	entries, err := fs.ReadDir(g.TemplateFS, ".")
	if err != nil {
		t.Fatalf("read templates dir: %v", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		ext := path.Ext(name)
		if ext == ".js" || name == "partials.html" {
			continue
		}

		body, err := fs.ReadFile(g.TemplateFS, name)
		if err != nil {
			t.Errorf("%s: read: %v", name, err)
			continue
		}
		sanitized := g.sanitizeTemplate(string(body))

		switch ext {
		case ".html":
			combined := partialsSan + "\n" + sanitized
			if _, err := htmltemplate.New(name).Delims("[[", "]]").Funcs(htmlFuncs).Parse(combined); err != nil {
				t.Errorf("%s: HTML parse: %v", name, err)
			}
		default:
			if _, err := texttemplate.New(name).Delims("[[", "]]").Funcs(textFuncs).Parse(sanitized); err != nil {
				t.Errorf("%s: text parse: %v", name, err)
			}
		}
	}
}

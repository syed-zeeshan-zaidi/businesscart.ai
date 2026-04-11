package generator

import (
	"encoding/xml"
	"fmt"
	"strings"
	"time"
)

// Google Shopping RSS 2.0 feed with g: namespace.
// Spec: https://support.google.com/merchants/answer/7052112

func buildGoogleFeed(data StorefrontData) ([]byte, error) {
	domain := data.Domain
	if domain == "" {
		return nil, fmt.Errorf("no domain configured")
	}

	now := time.Now()
	var items []googleItem
	for _, p := range data.Products {
		if p.Price <= 0 {
			continue
		}
		availability := "in_stock"
		if p.Stock <= 0 {
			availability = "out_of_stock"
		}

		item := googleItem{
			ID:           p.ID,
			Title:        p.Name,
			Description:  stripHTML(p.Description),
			Link:         fmt.Sprintf("https://%s/products/%s.html", domain, p.Filename),
			Availability: availability,
			Price:        fmt.Sprintf("%.2f USD", p.Price),
			Condition:    "new",
			Brand:        data.Company.Name,
		}

		if len(p.Images) > 0 {
			item.ImageLink = p.Images[0]
			if len(p.Images) > 1 {
				item.AdditionalImageLinks = p.Images[1:]
			}
		}

		// Active deal → sale_price
		if p.DealPrice > 0 && p.DiscountedPrice > 0 {
			active := true
			if p.DealStartDate != nil && p.DealStartDate.After(now) {
				active = false
			}
			if p.DealEndDate != nil && p.DealEndDate.Before(now) {
				active = false
			}
			if active {
				item.SalePrice = fmt.Sprintf("%.2f USD", p.DiscountedPrice)
			}
		}

		if p.Barcode != "" {
			item.GTIN = p.Barcode
		}
		if p.SKU != "" {
			item.MPN = p.SKU
		}
		if p.Category != "" {
			item.ProductType = p.Category
		}
		if item.GTIN == "" && item.MPN == "" {
			item.IdentifierExists = "false"
		}

		items = append(items, item)
	}

	feed := googleFeed{
		Version:    "2.0",
		GoogleNS:   "http://base.google.com/ns/1.0",
		Title:      data.Company.Name + " — Product Catalog",
		Link:       "https://" + domain,
		Desc:       "Shopping feed for " + data.Company.Name,
		Items:      items,
	}

	output, err := xml.MarshalIndent(feed, "", "  ")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), output...), nil
}

type googleFeed struct {
	XMLName  xml.Name     `xml:"rss"`
	Version  string       `xml:"version,attr"`
	GoogleNS string       `xml:"xmlns:g,attr"`
	Title    string       `xml:"channel>title"`
	Link     string       `xml:"channel>link"`
	Desc     string       `xml:"channel>description"`
	Items    []googleItem `xml:"channel>item"`
}

type googleItem struct {
	ID                   string   `xml:"g:id"`
	Title                string   `xml:"g:title"`
	Description          string   `xml:"g:description"`
	Link                 string   `xml:"g:link"`
	ImageLink            string   `xml:"g:image_link,omitempty"`
	AdditionalImageLinks []string `xml:"g:additional_image_link,omitempty"`
	Availability         string   `xml:"g:availability"`
	Price                string   `xml:"g:price"`
	SalePrice            string   `xml:"g:sale_price,omitempty"`
	Condition            string   `xml:"g:condition"`
	Brand                string   `xml:"g:brand"`
	GTIN                 string   `xml:"g:gtin,omitempty"`
	MPN                  string   `xml:"g:mpn,omitempty"`
	ProductType          string   `xml:"g:product_type,omitempty"`
	IdentifierExists     string   `xml:"g:identifier_exists,omitempty"`
}

func stripHTML(s string) string {
	// Simple HTML tag stripper + newline normalizer for feed descriptions
	var b strings.Builder
	inTag := false
	for _, r := range s {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			continue
		}
		if !inTag {
			if r == '\n' || r == '\r' {
				b.WriteRune(' ')
			} else {
				b.WriteRune(r)
			}
		}
	}
	return strings.TrimSpace(b.String())
}

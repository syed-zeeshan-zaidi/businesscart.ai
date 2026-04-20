package generator

import (
	"fmt"
	"strings"
	"time"
)

// TikTok Shop / TikTok Ads product catalog CSV feed.
// Spec: https://seller-us.tiktok.com/
// Key differences: uses "sku_id" (not "id"), "google_product_category" optional (recommended),
// availability uses spaces ("in stock").

func buildTikTokFeed(data StorefrontData) ([]byte, error) {
	domain := data.Domain
	if domain == "" {
		return nil, fmt.Errorf("no domain configured")
	}

	now := time.Now()
	var b strings.Builder

	// Header — TikTok uses sku_id, not id
	b.WriteString("sku_id,title,description,availability,condition,price,image_link,brand,google_product_category,product_page_url,sale_price\n")

	for _, p := range data.Products {
		if p.Price <= 0 {
			continue
		}
		availability := "in stock"
		if p.Stock <= 0 {
			availability = "out of stock"
		}

		salePrice := ""
		if p.DealPrice > 0 && p.DiscountedPrice > 0 {
			active := true
			if p.DealStartDate != nil && p.DealStartDate.After(now) {
				active = false
			}
			if p.DealEndDate != nil && p.DealEndDate.Before(now) {
				active = false
			}
			if active {
				salePrice = fmt.Sprintf("%.2f USD", p.DiscountedPrice)
			}
		}

		image := ""
		if len(p.Images) > 0 {
			image = p.Images[0]
		}

		// TikTok requires google_product_category — use category as best effort
		googleCategory := feedCategory(p.Category)
		if googleCategory == "" {
			googleCategory = "Other"
		}

		b.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%.2f USD,%s,%s,%s,%s,%s\n",
			csvEscape(p.ID),
			csvEscape(p.Name),
			csvEscape(stripHTML(p.Description)),
			csvEscape(availability),
			"new",
			p.Price,
			csvEscape(image),
			csvEscape(data.Company.Name),
			csvEscape(googleCategory),
			csvEscape(fmt.Sprintf("https://%s/products/%s.html", domain, p.Filename)),
			csvEscape(salePrice),
		))
	}

	return []byte(b.String()), nil
}

package generator

import (
	"fmt"
	"strings"
	"time"
)

// Facebook / Instagram / Meta Commerce Manager CSV feed.
// Spec: https://www.facebook.com/business/help/120325381656392
// Key difference from Google: availability uses spaces ("in stock", not "in_stock").

func buildFacebookFeed(data StorefrontData) ([]byte, error) {
	domain := data.Domain
	if domain == "" {
		return nil, fmt.Errorf("no domain configured")
	}

	now := time.Now()
	var b strings.Builder

	// Header
	b.WriteString("id,title,description,availability,condition,price,link,image_link,brand,sale_price\n")

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

		b.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%.2f USD,%s,%s,%s,%s\n",
			csvEscape(p.ID),
			csvEscape(p.Name),
			csvEscape(stripHTML(p.Description)),
			csvEscape(availability),
			"new",
			p.Price,
			csvEscape(fmt.Sprintf("https://%s/products/%s.html", domain, p.Filename)),
			csvEscape(image),
			csvEscape(data.Company.Name),
			csvEscape(salePrice),
		))
	}

	return []byte(b.String()), nil
}

// csvEscape wraps value in quotes if it contains comma, quote, or newline.
func csvEscape(s string) string {
	if strings.ContainsAny(s, ",\"\n\r") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

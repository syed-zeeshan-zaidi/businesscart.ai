package generator

import (
	"fmt"
	"strings"
	"time"
)

// Pinterest product catalog CSV feed.
// Spec: https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs
// Uses spaces in availability ("in stock"), price format "29.99 USD".

func buildPinterestFeed(data StorefrontData) ([]byte, error) {
	domain := data.Domain
	if domain == "" {
		return nil, fmt.Errorf("no domain configured")
	}

	now := time.Now()
	var b strings.Builder

	// Header
	b.WriteString("id,title,description,link,image_link,price,availability,condition,brand,product_type,sale_price\n")

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

		b.WriteString(fmt.Sprintf("%s,%s,%s,%s,%s,%.2f USD,%s,%s,%s,%s,%s\n",
			csvEscape(p.ID),
			csvEscape(p.Name),
			csvEscape(stripHTML(p.Description)),
			csvEscape(fmt.Sprintf("https://%s/products/%s.html", domain, p.Filename)),
			csvEscape(image),
			p.Price,
			csvEscape(availability),
			"new",
			csvEscape(data.Company.Name),
			csvEscape(p.Category),
			csvEscape(salePrice),
		))
	}

	return []byte(b.String()), nil
}

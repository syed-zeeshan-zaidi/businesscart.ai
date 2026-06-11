# [[.Product.Name]]

## Product Specifications
- **Name**: [[.Product.Name]]
- **Price**: $[[printf "%.2f" .Product.Price]] USD[[if .Product.DealPrice]]
- **Sale Price**: $[[printf "%.2f" .Product.DiscountedPrice]] USD ([[printf "%.0f" .Product.DealPrice]]% off)[[end]]
- **Category**: [[.Product.Category]]
- **Availability**: [[if gt .Product.Stock 0]]In Stock ([[.Product.Stock]] available)[[else]]Out of Stock[[end]][[if .Product.SKU]]
- **SKU**: [[.Product.SKU]][[end]][[if .Product.Barcode]]
- **Barcode**: [[.Product.Barcode]][[end]]
- **Description**: [[.Product.Description]]
[[if .Product.Image]]- **Image**: [[.Product.Image]][[end]]

[[if .Product.PriceTiers]]## Volume Pricing
[[range .Product.PriceTiers]]- [[.MinQty]]+ units: $[[printf "%.2f" .Price]]
[[end]][[end]]
[[if .Product.Attributes]]## Attributes
[[range .Product.Attributes]]- **[[.Key]]**: [[.Value]]
[[end]][[end]]
[[if and .Product.Rating (gt .Product.Rating.Count 0)]]## Customer Reviews
**Average Rating**: [[printf "%.1f" .Product.Rating.Average]] / 5 (based on [[.Product.Rating.Count]] review[[if ne .Product.Rating.Count 1]]s[[end]])

[[range .Product.Rating.Reviews]]### [[.Rating]] / 5[[if .Title]] — [[.Title]][[end]]
*By [[.Name]][[if .Verified]] (Verified Purchase)[[end]] on [[.Date.Format "Jan 2, 2006"]]*

[[.Body]]

[[end]][[end]]
[[if .RelatedProducts]]## Related Products
[[range .RelatedProducts]]- [[.Name]] — $[[printf "%.2f" .Price]][[if .DealPrice]] (Sale: $[[printf "%.2f" .DiscountedPrice]])[[end]] — [View](../products/[[.Filename]].md)
[[end]][[end]]
## Contextual Links
- **Company**: [[.Company.Name]]
- **Storefront Home**: [index.md](../index.md)
- **Full Catalog**: [products.md](../products.md)
- **HTML Version**: [View Page]([[.Product.Filename]].html)

## Metadata
- **Generated**: [[.Timestamp]]
- **Product ID**: [[.Product.ID]]

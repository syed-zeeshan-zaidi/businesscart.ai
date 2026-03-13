# [[.Product.Name]]

## Product Specifications
- **Name**: [[.Product.Name]]
- **Price**: $[[printf "%.2f" .Product.Price]] USD[[if .Product.DealPrice]]
- **Sale Price**: $[[printf "%.2f" .Product.DiscountedPrice]] USD ([[printf "%.0f" .Product.DealPrice]]% off)[[end]]
- **Category**: [[.Product.Category]]
- **Description**: [[.Product.Description]]
[[if .Product.Image]]- **Image**: [[.Product.Image]][[end]]

[[if .Product.Attributes]]## Attributes
[[range .Product.Attributes]]- **[[.Key]]**: [[.Value]]
[[end]][[end]]

## Contextual Links
- **Company**: [[.Company.Name]]
- **Storefront Home**: [index.md](../index.md)
- **Full Catalog**: [products.md](../products.md)
- **HTML Version**: [View Page]([[.Product.Filename]].html)

## Metadata
- **Generated**: [[.Timestamp]]
- **Product ID**: [[.Product.ID]]

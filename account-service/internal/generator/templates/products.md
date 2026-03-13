# [[.Company.Name]] — Full Product Catalog

[[len .Products]] products available.

## Categories
[[range .Categories]]- [[.]]
[[end]]

## Products
[[range .Products]]
### [[.Name]]
- **Price**: $[[printf "%.2f" .Price]][[if .DealPrice]] (Sale: $[[printf "%.2f" .DiscountedPrice]] — [[printf "%.0f" .DealPrice]]% off)[[end]]
- **Category**: [[.Category]]
- **Description**: [[.Description]]
[[if .Attributes]]- **Specifications**:
[[range .Attributes]]  - [[.Key]]: [[.Value]]
[[end]][[end]]- **Details**: [View Product](products/[[.Filename]].md)

[[end]]
## Metadata
- **Company**: [[.Company.Name]]
- **Generated**: [[.Timestamp]]

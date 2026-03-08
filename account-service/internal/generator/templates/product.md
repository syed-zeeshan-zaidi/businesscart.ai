# Product Context: [[.Product.Name]]

## Product Specifications
- **Name**: [[.Product.Name]]
- **Price**: $[[.Product.Price]]
- **Category**: [[.Product.Category]]
- **Description**: [[.Product.Description]]

[[if .Product.Attributes]]
## Attributes
[[range .Product.Attributes]]
- **[[.Key]]**: [[.Value]]
[[end]]
[[end]]

## Contextual Links
- **Company**: [[.Company.Name]]
- **Storefront Home**: [index.md](../index.md)

## Metadata
- **Generated**: [[.Timestamp]]
- **Product ID**: [[.Product.ID]]

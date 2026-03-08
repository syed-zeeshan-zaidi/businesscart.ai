# [[.Company.Name]] Storefront Context

## Company Overview
- **Name**: [[.Company.Name]]
- **Slogan**: [[.Config.HeroSlogan]]
- **Contact**: [[.Config.ContactEmail]] / [[.Config.ContactPhone]]

## Product Catalog Summary
This storefront contains [[len .Products]] products.

### Product List
[[range .Products]]
- **[[.Name]]**: $[[.Price]] ([[if .Image]]Image Available[[else]]No Image[[end]])
  - Slug: [[.Slug]]
  - Category: [[.Category]]
[[end]]

## Metadata
- **Generated**: [[.Timestamp]]
- **Year**: [[.Year]]

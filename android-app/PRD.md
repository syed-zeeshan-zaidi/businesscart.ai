# Android App Product Requirements Document

## Catalog Enhancement Plan

### 1. High-Level Plan

The current Android catalog is functional but lacks the advanced features of the web portal. This plan will enhance the catalog by adding critical search and filtering capabilities, as well as a product detail view, to improve the user experience.

### 2. Task List

**A. Implement Search Functionality** (Completed)

1.  **Update `activity_catalog.xml`:** (Completed)
    *   Add a `SearchView` widget to the top of the layout for text-based product searches.
2.  **Update `CatalogActivity.kt`:** (Completed)
    *   Implement a `OnQueryTextListener` for the `SearchView`.
    *   In the listener, update the product list filter to match the product name against the search query.

**B. Implement Category Filtering** (Completed)

1.  **Update `activity_catalog.xml`:** (Completed)
    *   Add a second `Spinner` widget next to the company filter for product categories.
2.  **Update `CatalogActivity.kt`:** (Completed)
    *   When products are first fetched, create a unique, sorted list of all product categories.
    *   Populate the new category `Spinner` with this list, including an "All Categories" option.
    *   Add an `OnItemSelectedListener` to the category spinner.
    *   Update the main filtering logic to account for the selected category.

**C. Implement Product Detail View** (Completed)

1.  **Create `ProductDetailActivity.kt`:** (Completed)
    *   Create a new activity to display the details of a single product.
    *   This activity will receive a Product object (or its ID) via an Intent.
2.  **Create `activity_product_detail.xml`:** (Completed)
    *   Design a layout to display all fields of a `Product` object, including name, description, price, image, and attributes.
    *   Include an "Add to Cart" button on this screen.
3.  **Update `ProductAdapter.kt`:** (Completed)
    *   Modify the `onClickListener` for each product item.
    *   Instead of adding to the cart directly, it should now launch `ProductDetailActivity`, passing the selected product's data in the Intent.

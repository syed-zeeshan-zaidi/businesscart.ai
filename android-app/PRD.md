# Android App Product Requirements Document

## Discounted Pricing Feature

### Updated Plan for Implementation

**1. Update Data Models:** (Completed)

*   **`Product.kt`:** Add a `discountedPrice` field to the `Product` data class. This field will be nullable. (Completed)
*   **`AuthModels.kt`:**
    *   Update `CustomerData` to use `customerConfigs` instead of `customerCodes`. (Completed)
    *   Update `CustomerCodeEntry` to include a nullable `configuration` field of type `CustomerConfiguration`. (Completed)
    *   Add the `CustomerConfiguration` data class with a `discountPercentage` field. (Completed)

**2. Update API Service:**

*   **`ApiService.kt`:** No changes are required.

**3. Update UI Layer:**

*   **`ProductAdapter.kt`:**
    *   Modify the `ProductViewHolder` to check for a `discountedPrice`.
    *   If a discounted price exists, display it and show the original price with a strikethrough.
    *   Otherwise, display the original price.

**4. Correct Inconsistencies:**

*   **`account-service/internal/auth/auth.go`:** In the `CustomerConfiguration` struct within the `auth` package, change the JSON tag for `DiscountPercentage` from `discount` to `discountPercentage` to match the rest of the application.
*   **`web-portal/src/types.ts`:** In the `CustomerConfiguration` interface, change the `company_id` field to `codeId` to match the `CustomerCodeEntry` interface.

**5. Testing:**

*   Manually test the Android app, web portal, and `account-service` to ensure the changes work as expected.

# Web Portal PRD

## Refactoring: customerCodes to customerConfig

This section outlines the plan to update the web-portal to use the new `customerConfig` field.

### Task List:

- [x] **Task 1:** In `src/api.ts`, update the `createQuote` function to accept customer-specific configurations.
- [x] **Task 2:** In `src/api.ts`, create a `getCustomerConfigurations` function to decode the JWT using `getUserClaims` and return the `customerConfig`.
- [x] **Task 3:** In `src/pages/Cart.tsx`, update the `handleCheckout` function to call `getCustomerConfigurations` and pass the configurations to `createQuote`.

## Future Improvements

-   **Refactor Catalog Data Fetching:** The product catalog currently fetches all products for all associated companies at once and performs filtering on the client-side. To improve performance and scalability, this should be refactored to fetch only the products for the currently selected company by passing the `companyId` to the `getProducts` API endpoint.
-   **Improve Cart Quantity Update UX:** The quantity input in the cart triggers an API call on every change, which is inefficient. This should be refactored to use a manual "Update" button that appears when the quantity is changed, giving the user explicit control over when the update occurs.
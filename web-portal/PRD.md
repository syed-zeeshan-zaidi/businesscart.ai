# Web Portal PRD

## Refactoring: customerCodes to customerConfig

This section outlines the plan to update the web-portal to use the new `customerConfig` field.

### Task List:

- [x] **Task 1:** In `src/api.ts`, update the `createQuote` function to accept customer-specific configurations.
- [x] **Task 2:** In `src/api.ts`, create a `getCustomerConfigurations` function to decode the JWT using `getUserClaims` and return the `customerConfig`.
- [x] **Task 3:** In `src/pages/Cart.tsx`, update the `handleCheckout` function to call `getCustomerConfigurations` and pass the configurations to `createQuote`.
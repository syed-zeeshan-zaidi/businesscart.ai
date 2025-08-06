# Migration Plan: Multi-Step Checkout Flow

This document outlines the plan to refactor the checkout process into a more robust, multi-step flow involving a "quote" stage before the final order placement.

## 1. Overview

The goal is to decouple the calculation of a checkout (including taxes, shipping, and promotions) from the final payment and order creation. This is achieved by introducing a `/quotes` endpoint. The frontend will first request a quote, display the detailed breakdown to the user, and only upon final confirmation, will it proceed to place the order with a second API call.

This approach provides a better user experience, reduces errors, and gives us a valuable data point (abandoned quotes) for business analysis.

## 2. New Checkout Flow

1.  **Cart Management**: The user manages their cart on the `/cart` page, which uses the `/cart` endpoints of the `checkout-service`. (No change to this part).
2.  **Initiate Checkout (Quote Step)**:
    *   The user clicks "Proceed to Checkout".
    *   The frontend sends a `POST` request to a new `/quotes` endpoint in the `checkout-service`.
    *   The `checkout-service` calculates shipping, taxes, and promotions, then saves this information as a "quote" in a new `quotes` collection in the database.
    *   The service responds with the comprehensive quote object.
3.  **Display Quote**:
    *   The `/checkout` page is populated with the detailed data from the quote object.
    *   The page displays the final payment options (e.g., Stripe, Braintree).
4.  **Place Order**:
    *   The user enters payment details and clicks "Place Order".
    *   The frontend sends a `POST` request to a new `/orders` endpoint in the `checkout-service`, including the `quoteId` and a `paymentToken`.
    *   The `checkout-service` retrieves the quote, processes the payment, and if successful, creates a permanent record in the `orders` collection.
    *   The original quote and cart are then deleted.
5.  **Order Confirmation**: The user is shown a success page with the final order details.

## 3. Backend Implementation (`checkout-service`)

### 3.1. New `Quote` Model
A new `quotes` collection will be created with a structure similar to this:
```
{
  "_id": "...",
  "cartId": "...",
  "userId": "...",
  "companyId": "...",
  "items": [ ... ],
  "subtotal": 100.00,
  "shippingCost": 10.00,
  "taxAmount": 8.25,
  "grandTotal": 118.25,
  "createdAt": "...",
  "expiresAt": "..."
}
```

### 3.2. New Endpoints
*   **`POST /quotes`**:
    *   **Handler**: `handleCreateQuote`
    *   **Logic**: Takes a `cartId`, `userId`, and `companyId`. Fetches the cart, performs all calculations, saves the new quote, and returns it.
*   **`POST /orders`**:
    *   **Handler**: `handlePlaceOrder`
    *   **Logic**: Takes a `quoteId` and `paymentToken`. Retrieves the quote, processes payment, creates the final order, and cleans up the cart and quote.

## 4. Infrastructure (CDK)
The `lib/checkout-service-stack.ts` will be updated to add the new `/quotes` and `/orders` resources and their `POST` methods to the `RestApi` construct.

## 5. Frontend Implementation (`web-portal`)

*   **`api.ts`**:
    *   A new `createQuote(cartId)` function will be added.
    *   A new `placeOrder(quoteId, paymentToken)` function will be added.
*   **`Cart.tsx`**: The "Proceed to Checkout" button will now call `createQuote` and navigate to the `/checkout` page, passing the `quoteId`.
*   **`Checkout.tsx`**: This page will be updated to:
    *   Fetch the quote details using the `quoteId` from the URL.
    *   Display the full quote breakdown.
    *   Handle the payment form submission, calling `placeOrder` on success.
*   **`types.ts`**: A new `Quote` interface will be added.

## 6. Test Script (`test_full_api_flow.sh`)
The script will be updated to reflect the new two-step process:
1.  Create users, companies, products, and add items to the cart as before.
2.  Call the `POST /quotes` endpoint to generate a quote.
3.  Use the returned `quoteId` to call the `POST /orders` endpoint to finalize the transaction.
4.  Verify the responses at each stage.

## 7. Payment Service Migration
The `payment-service` has been consolidated into the `checkout-service`. The `checkout-service` now directly handles payment processing.
**Note**: The current implementation for Stripe and Amazon Pay is mocked for testing purposes and does not connect to live payment gateways.

## 8. Leftover Work
- **Real Payment Gateway Integration**: Replace the mocked payment logic with actual SDKs for Stripe and Amazon Pay.
- **Implement Promotion Service**: The promotion logic is currently a placeholder. A dedicated promotion service or module should be created to handle promo codes and discounts.
- **Implement Shipping Service**: The shipping calculation is currently a flat rate. A more sophisticated shipping service should be integrated to calculate shipping costs based on weight, dimensions, and destination.
- **Implement Tax Service**: The tax calculation is a simple percentage. A dedicated tax service should be integrated to handle different tax rates based on location.
- **Security Hardening**: Implement rate limiting, more robust input validation, and a general security review of all services.
- **Logging and Monitoring**: Implement structured logging (e.g., JSON) and integrate with a monitoring service like AWS CloudWatch for better observability.
- **Configuration Management**: Move secrets and other configuration into a secure and manageable service like AWS Secrets Manager or Parameter Store.
- **Improve Error Handling**: The error handling in the `checkout-service` can be improved to provide more specific error messages to the frontend.
- **Add Unit and E2E Tests**: The `checkout-service` currently lacks unit tests. Unit tests should be added to ensure the correctness of the business logic. Add end-to-end tests for the entire application flow.
- **Frontend Polish**: Improve the UI/UX of the web portal, implement better state management, and add more comprehensive tests.
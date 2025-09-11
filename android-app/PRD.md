# Product Requirements Document: BusinessCart Android App

## 1. Introduction

This document outlines the product requirements for the BusinessCart Android application. The app will provide a native mobile experience for "customer" users of the BusinessCart platform, focusing on core features available in the web portal. The implementation of "company" user features is postponed until next year.

## 2. Goals

*   Provide a fast, intuitive, and user-friendly native Android experience for customer users.
*   Allow "customer" users to easily browse products, manage their cart, and place orders from their mobile devices.
*   Maintain consistency with the existing BusinessCart web portal in terms of branding and functionality.

## 3. User Personas

*   **Customer User:** An employee of a business who purchases supplies from other companies on the BusinessCart platform. They need a simple way to find products, see what's in their cart for each supplier, and place orders.
*   **Company User:** (Out of Scope for initial release) A business owner or employee who needs to manage their online store.

## 4. Feature Breakdown

The Android app will be built using Kotlin, the officially recommended language for Android development. We will use the MVVM (Model-View-ViewModel) architecture pattern to create a scalable and maintainable codebase. We will use standard Android UI components and avoid external UI libraries to keep the app lightweight and performant.

**Phase 1: Core Authentication & Setup (1-2 weeks)**

*   **Project Setup:**
    *   **Status:** Completed.
*   **User Authentication:**
    *   **Login Screen:** A simple screen with email and password fields, and a "Login" button.
        *   **Status:** Implemented.
    *   **Registration Screen:** A screen with fields for name, email, password, and phone number. The role will be defaulted to "customer".
        *   **Status:** Implemented.
    *   **API Integration:** Implement the `login` and `register` API calls.
        *   **Status:** Implemented.
    *   **Session Management:** Store the JWT securely on the device (e.g., using Android's EncryptedSharedPreferences).
        *   **Status:** Implemented.

**Phase 2: Customer User Features (2-3 weeks)**

*   **Product Catalog:**
    *   **Company Selection:** A dropdown or similar UI element to allow the customer to select which company's products they want to view.
        *   **Status:** Implemented.
    *   **Product List Screen:** A screen displaying a grid or list of products from the selected company.
        *   **Status:** Implemented.
    *   **API Integration:** Use the `getProducts` and `getCompanies` endpoints.
        *   **Status:** Implemented.
*   **Cart:**
    *   **Cart Screen:** A screen that displays the items in the user's cart for the currently selected company. Users should be able to update the quantity of items or remove them from the cart.
        *   **Status:** Implemented.
    *   **API Integration:** Implement `getCart`, `addItemToCart`, `updateCartItem`, and `removeItemFromCart` API calls.
        *   **Status:** `getCart` and `addItemToCart` are implemented.
*   **Order History:**
    *   **Order List Screen:** A screen displaying a list of the customer's past orders.
        *   **Status:** Not Implemented.
    *   **Order Detail Screen:** A screen showing the details of a specific order.
        *   **Status:** Not Implemented.
    *   **API Integration:** Use the `getOrders` endpoint, filtering by the customer's user ID.
        *   **Status:** Not Implemented.

**Phase 3: Advanced Checkout Implementation**

This phase implements the full, company-specific checkout flow, including the quote lifecycle (upsert) and conditional delivery and payment options.

**Status:** Completed

1.  **Data Models (`app/src/main/java/.../model/DataModels.kt`):**
    *   **Task:** Update the `Quote` data class.
    *   **Details:** Add fields to store the company's configurations: `availablePaymentMethods: List<String>`, `availableDeliveryMethods: List<String>`, and `availableShippingOutOptions: List<String>`.
    *   **Status:** Completed

2.  **API Service (`app/src/main/java/.../api/CheckoutApiService.kt`):**
    *   **Task:** Update the `createQuote` API call.
    *   **Details:** The request body will be updated to send the seller ID and all three configuration arrays (`paymentMethods`, `deliveryMethods`, `shippingOutOptions`).
    *   **Status:** Completed

3.  **Cart Screen (`.../view/CartActivity.kt` & `.../viewmodel/CartViewModel.kt`):**
    *   **Task:** Update the checkout logic.
    *   **Details:** When the checkout button is clicked, the `CartViewModel` will find the selected company's full configuration from the user's `Account` data and call the updated `createQuote` function with the complete payload. It will then navigate to the `CheckoutActivity`, passing the `quoteId`.
    *   **Status:** Completed

4.  **Checkout Screen (New `.../view/CheckoutActivity.kt` & `.../viewmodel/CheckoutViewModel.kt`):**
    *   **Task:** Implement the conditional UI and filtering logic.
    *   **Details:**
        *   The `CheckoutViewModel` will fetch the full `Quote` using the `quoteId`.
        *   The `CheckoutActivity` UI will contain `Spinner` dropdowns for Delivery Method and Shipping Options, and a `RadioGroup` for Payment Methods.
        *   The Shipping Options `Spinner` will only be visible if the selected delivery method is "shipping_out".
        *   The `CheckoutViewModel` will filter the available payment methods based on the selected delivery method, and the UI will update dynamically.
    *   **Status:** Completed

5.  **Manifest & Navigation:**
    *   **Task:** Declare new Activities.
    *   **Details:** Add the new `CheckoutActivity` and `OrderSuccessActivity` to the `AndroidManifest.xml`.
    *   **Status:** Completed

**Phase 5: Delivery and Pickup Location Implementation**

This phase integrates the selection of delivery addresses and company pickup locations into the checkout flow.

1.  **Data Models (`.../model/`):
    *   **Task:** Update data models to include location and address information.
    *   **Details:**
        *   Ensure `Account` and `CustomerData` models are updated to include `customerAddresses: List<CustomerAddress>`.
        *   Update the `Quote` data class to include `customerAddresses: List<CustomerAddress>?`.
        *   Update the `Order` data class to include `deliveryAddressId: String?` and `deliveryMethod: String`.
    *   **Status:** Not Started.

2.  **API Service (`.../api/`):
    *   **Task:** Update API service interfaces.
    *   **Details:**
        *   Update the `createQuote` function to include `customerAddresses` in the request body.
        *   Update the `createOrder` function to accept `deliveryAddressId` and `deliveryMethod`.
    *   **Status:** Not Started.

3.  **Cart Screen (`.../ui/cart/`):
    *   **Task:** Enhance the checkout process initiation.
    *   **Details:** The `CartViewModel` will be updated to pass the `customerAddresses` from the user's `Account` data when calling `createQuote`.
    *   **Status:** Not Started.

4.  **Checkout Screen (`.../ui/checkout/`):
    *   **Task:** Implement address selection UI.
    *   **Details:**
        *   The `CheckoutViewModel` will manage the state for the selected `deliveryAddressId`.
        *   A `Spinner` for "Delivery Address" will be added to the UI.
        *   This dropdown will be visible only when the selected delivery method is **not** 'pickup'.
        *   The `createOrder` call will be updated to include the selected `deliveryAddressId`.
    *   **Status:** Not Started.

## 5. Non-Functional Requirements

*   **Performance:** The app should be fast and responsive, with smooth scrolling and quick screen transitions.
*   **Security:** All API communication must be over HTTPS. Sensitive data, such as the JWT, must be stored securely on the device.
*   **Error Handling:** The app should gracefully handle network errors and API errors, providing clear feedback to the user.

## 6. API V2 Migration Plan (Corrected)

This section outlines the necessary changes to update the Android app to work with the new backend API (V2). The V2 API introduces a consolidated checkout service, a new authentication flow, and updated data models.

**Status:** Not Started

### 6.1. Authentication & Core Models

*   **Replace `User` Model:**
    *   **Status:** Completed
    *   **Details:** In `model/AuthModels.kt`, remove the `User` data class and replace it with a new `Account` data class that mirrors the structure of the `Account` model in the `account-service`. This will include nested data classes for `CompanyData`, `CustomerData`, etc.
*   **Update API Endpoints:**
    *   **Status:** Completed
    *   **Details:** In `api/ApiService.kt`, change the `register` endpoint from `users/register` to `accounts/register` and the `login` endpoint from `users/login` to `accounts/login`.
*   **Update Registration Flow:**
    *   **Status:** Completed
    *   **Details:** In `model/AuthModels.kt`, update the `RegistrationRequest` data class to include an optional `customerCodes` field. The registration UI will need to be updated to allow users to enter one or more customer codes. The role will be hardcoded to "customer".
*   **Update `LoginResponse`:**
    *   **Status:** Completed
    *   **Details:** The `LoginResponse` in `model/AuthModels.kt` should now contain an `Account` object instead of a `User` object.

### 6.2. Product Catalog

*   **Update `Product` Model:**
    *   **Status:** Completed
    *   **Details:** In `model/DataModels.kt`, update the `Product` data class. Rename the `userId` and `companyId` fields to `sellerID`.

### 6.3. Checkout Flow

*   **Update `Cart`, `Quote`, and `Order` Models:**
    *   **Status:** Completed
    *   **Details:** In `model/DataModels.kt`, update the `Cart`, `Quote`, and `Order` data classes. Rename `userId` to `accountId` and `companyId` to `sellerId`.
*   **Update `CheckoutApiService.kt`:**
    *   **Status:** Completed
    *   **Details:** In `api/CheckoutApiService.kt`, update the `createQuote` function. The request body should be changed to `CreateQuoteRequest(val cartId: String, val sellerId: String)`. The `getCart` function should also be updated to use `sellerId` instead of `companyId`.
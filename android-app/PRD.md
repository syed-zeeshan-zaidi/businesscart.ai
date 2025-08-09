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
*   **Checkout:**
    *   **Checkout Screen:** A screen that displays the order summary (subtotal, shipping, tax, grand total) and allows the user to select a payment method.
        *   **Status:** Implemented.
    *   **API Integration:** Implement `createQuote` and `createOrder` API calls.
        *   **Status:** Implemented.
*   **Order History:**
    *   **Order List Screen:** A screen displaying a list of the customer's past orders.
        *   **Status:** Not Implemented.
    *   **Order Detail Screen:** A screen showing the details of a specific order.
        *   **Status:** Not Implemented.
    *   **API Integration:** Use the `getOrders` endpoint, filtering by the customer's user ID.
        *   **Status:** Not Implemented.

## 5. Non-Functional Requirements

*   **Performance:** The app should be fast and responsive, with smooth scrolling and quick screen transitions.
*   **Security:** All API communication must be over HTTPS. Sensitive data, such as the JWT, must be stored securely on the device.
*   **Error Handling:** The app should gracefully handle network errors and API errors, providing clear feedback to the user.

# Product Requirements Document: BusinessCart

## 1. Introduction

This document outlines the product requirements for the BusinessCart application. BusinessCart is a B2B e-commerce platform designed to facilitate transactions between companies and their customers. The platform is built on a microservices architecture, with separate services for managing users, companies, products, carts, orders, and more. This document details the current state of the application, including its architecture, features, and areas for future development.

## 2. System Architecture

The BusinessCart application is built on a **serverless, cloud-native, and event-driven architecture**. It leverages AWS services for hosting and managing the different microservices. The entire infrastructure is defined using **Infrastructure as Code (IaC)** with the **AWS Cloud Development Kit (CDK)**, and the application is written in **TypeScript**.

### 2.1. Architectural Principles

*   **Microservices:** The application is divided into small, independent services that can be developed, deployed, and scaled independently.
*   **Serverless:** The services are deployed as AWS Lambda functions, which allows for automatic scaling and pay-per-use pricing.
*   **Cloud-Native:** The application is designed to take full advantage of the benefits of cloud computing, such as scalability, reliability, and cost-effectiveness.
*   **Event-Driven:** The services communicate with each other through events, which allows for loose coupling and greater flexibility.
*   **Infrastructure as Code (IaC):** The entire infrastructure is defined as code using the AWS CDK, which allows for automated provisioning and management.
*   **TypeScript:** The application is written in TypeScript, which provides static typing and other features that improve code quality and maintainability.

### 2.2. Architecture Diagram

```
+-----------------+      +-----------------+      +-----------------+
|   Web Portal    |----->|  API Gateway    |----->| Authorizer      |
+-----------------+      +-----------------+      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->|   User Service  |
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->| Company Service |
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->| Product Service |
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->|   Cart Service  |
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->|   Order Service |
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->| Checkout Service|
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->|  Payment Service|
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->| Shipping Service|
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->| Promotion Service|
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->|    Tax Service  |
                           +-----------------+      +-----------------+
```

### 2.3. Microservices

*   **User Service:** Manages user authentication, registration, and user data.
*   **Company Service:** Manages company profiles and customer associations.
*   **Product Service:** Manages product information, including pricing and inventory.
*   **Cart Service:** Manages shopping carts for customers.
*   **Order Service:** Manages customer orders.
*   **Checkout Service:** Orchestrates the checkout process.
*   **Payment Service:** Handles payment processing (placeholder).
*   **Shipping Service:** Handles shipping and logistics (placeholder).
*   **Promotion Service:** Manages promotions and discounts (placeholder).
*   **Tax Service:** Calculates taxes (placeholder).
*   **Web Portal:** The frontend application for users to interact with the platform.
*   **Authorizer Service:** Provides authorization for API Gateway endpoints.

## 3. Data Flow Example: Customer Places an Order

1.  The customer adds products to their cart from the **Web Portal**.
2.  The **Web Portal** sends a request to the **Cart Service** to add the items to the cart.
3.  The customer proceeds to checkout.
4.  The **Web Portal** sends a request to the **Checkout Service** to initiate the checkout process.
5.  The **Checkout Service** retrieves the cart information from the **Cart Service**.
6.  The **Checkout Service** creates an order in the **Order Service**.
7.  The **Checkout Service** processes the payment through the **Payment Service**.
8.  The **Checkout Service** arranges for shipping through the **Shipping Service**.
9.  The **Checkout Service** applies any promotions through the **Promotion Service**.
10. The **Checkout Service** calculates taxes through the **Tax Service**.
11. The **Checkout Service** sends a confirmation to the customer through the **Web Portal**.

## 4. Databases

The following services utilize a MongoDB database:

### 4.1. User Service

*   **Users Collection:**
    *   `"name"`: `String` (required)
    *   `"email"`: `String` (required, unique)
    *   `"password"`: `String` (required, hashed)
    *   `"role"`: `String` (enum: `"customer"`, `"company"`, `"admin"`, required)
    *   `"company_id"`: `String`
    *   `"associate_company_ids"`: `[String]`
*   **Refresh Tokens Collection:**
    *   `"userId"`: `ObjectId` (required)
    *   `"token"`: `String` (required, unique)
    *   `"expiresAt"`: `Date` (required)
*   **Blacklisted Tokens Collection:**
    *   `"token"`: `String` (required, unique)
    *   `"expiresAt"`: `Date` (required)

### 4.2. Company Service

*   **Companies Collection:**
    *   `"name"`: `String` (required)
    *   `"description"`: `String`
    *   `"companyCode"`: `String` (required, unique)
    *   `"userId"`: `String` (required)
    *   `"address"`: `Object`
        *   `"street"`: `String` (required)
        *   `"city"`: `String` (required)
        *   `"state"`: `String` (required)
        *   `"zip"`: `String` (required)
        *   `"coordinates"`: `Object`
            *   `"lat"`: `Number` (required)
            *   `"lng"`: `Number` (required)
    *   `"sellingArea"`: `Object`
        *   `"radius"`: `Number` (required)
        *   `"center"`: `Object`
            *   `"lat"`: `Number` (required)
            *   `"lng"`: `Number` (required)
    *   `"paymentMethods"`: `[String]` (enum: `"cash"`, `"credit_card"`, required)
    *   `"customers"`: `[String]`

### 4.3. Product Service

*   **Products Collection:**
    *   `"name"`: `String` (required)
    *   `"description"`: `String`
    *   `"price"`: `Number` (required)
    *   `"companyId"`: `String` (required)
    *   `"userId"`: `String` (required)

### 4.4. Cart Service

*   **Carts Collection:**
    *   `"userId"`: `String` (required)
    *   `"companyId"`: `String` (required)
    *   `"items"`: `[Object]`
        *   `"productId"`: `String` (required)
        *   `"quantity"`: `Number` (required)
        *   `"companyId"`: `String` (required)
        *   `"name"`: `String`
        *   `"price"`: `Number`
    *   `"totalPrice"`: `Number`

### 4.5. Order Service

*   **Orders Collection:**
    *   `"base_grand_total"`: `Number` (required)
    *   `"grand_total"`: `Number` (required)
    *   `"customer_email"`: `String` (required)
    *   `"customer_id"`: `String`
    *   `"billing_address"`: `Object` (required)
        *   `"address_type"`: `String` (required)
        *   `"city"`: `String` (required)
        *   `"country_id"`: `String` (required)
        *   `"firstname"`: `String` (required)
        *   `"lastname"`: `String` (required)
        *   `"postcode"`: `String` (required)
        *   `"telephone"`: `String` (required)
        *   `"street"`: `[String]` (required)
    *   `"payment"`: `Object` (required)
        *   `"account_status"`: `String` (required)
        *   `"additional_information"`: `[String]` (required)
        *   `"cc_last4"`: `String` (required)
        *   `"method"`: `String` (required)
    *   `"items"`: `[Object]` (required)
        *   `"sku"`: `String` (required)
        *   `"name"`: `String` (required)
        *   `"qty_ordered"`: `Number` (required)
        *   `"price"`: `Number` (required)
        *   `"row_total"`: `Number` (required)
    *   `"company_id"`: `String` (required)
    *   `"user_id"`: `String` (required)

## 5. API Endpoints

### 5.1. User Service

*   **POST /users/register**
    *   **Request Body:**
        ```json
        {
          "name": "string",
          "email": "string",
          "password": "string",
          "role": "string" // "customer", "company", or "admin"
        }
        ```
    *   **Success Response:** `200 OK` with access and refresh tokens.
    *   **Error Response:** `400 Bad Request` for invalid input, `409 Conflict` if user already exists.
*   **POST /users/login**
    *   **Request Body:**
        ```json
        {
          "email": "string",
          "password": "string"
        }
        ```
    *   **Success Response:** `200 OK` with access and refresh tokens.
    *   **Error Response:** `400 Bad Request` for invalid credentials.
*   **POST /users/refresh**
    *   **Request Body:**
        ```json
        {
          "refreshToken": "string"
        }
        ```
    *   **Success Response:** `200 OK` with a new access token.
    *   **Error Response:** `400 Bad Request` for invalid refresh token.
*   **POST /users/logout**
    *   **Request Body:**
        ```json
        {
          "refreshToken": "string",
          "accessToken": "string"
        }
        ```
    *   **Success Response:** `200 OK`.
    *   **Error Response:** `400 Bad Request` for invalid tokens.
*   **POST /users/associate-company**
    *   **Request Body:**
        ```json
        {
          "companyId": "string"
        }
        ```
    *   **Success Response:** `200 OK`.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if user or company not found.
*   **GET /users**
    *   **Success Response:** `200 OK` with a list of users.
    *   **Error Response:** `403 Forbidden` for non-admin users.
*   **GET /users/{id}**
    *   **Success Response:** `200 OK` with the user object.
    *   **Error Response:** `404 Not Found` if user not found, `403 Forbidden` for unauthorized access.
*   **PATCH /users/{id}**
    *   **Request Body:**
        ```json
        {
          "company_id": "string"
        }
        ```
    *   **Success Response:** `200 OK` with the updated user object.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if user not found, `403 Forbidden` for unauthorized access.
*   **DELETE /users/{id}**
    *   **Success Response:** `204 No Content`.
    *   **Error Response:** `404 Not Found` if user not found, `403 Forbidden` for non-admin users.
*   **PUT /users/{id}**
    *   **Request Body:**
        ```json
        {
          "name": "string",
          "email": "string",
          "password": "string",
          "role": "string", // "customer", "company", or "admin"
          "phoneNumber": "string",
          "company_id": "string"
        }
        ```
    *   **Success Response:** `200 OK` with the updated user object.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if user not found, `403 Forbidden` for unauthorized access.

### 5.2. Company Service

*   **POST /companies**
    *   **Request Body:**
        ```json
        {
          "name": "string",
          "description": "string",
          "companyCode": "string",
          "address": {
            "street": "string",
            "city": "string",
            "state": "string",
            "zip": "string",
            "coordinates": {
              "lat": "number",
              "lng": "number"
            }
          },
          "sellingArea": {
            "radius": "number",
            "center": {
              "lat": "number",
              "lng": "number"
            }
          },
          "paymentMethods": ["string"] // "cash" or "credit_card"
        }
        ```
    *   **Success Response:** `201 Created` with the new company object.
    *   **Error Response:** `400 Bad Request` for invalid input, `403 Forbidden` for non-company users.
*   **GET /companies**
    *   **Success Response:** `200 OK` with a list of companies.
    *   **Error Response:** `403 Forbidden` for unauthorized access.
*   **GET /companies/{companyId}**
    *   **Success Response:** `200 OK` with the company object.
    *   **Error Response:** `404 Not Found` if company not found, `403 Forbidden` for unauthorized access.
*   **PUT /companies/{companyId}**
    *   **Request Body:** (Same as POST /companies)
    *   **Success Response:** `200 OK` with the updated company object.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if company not found, `403 Forbidden` for unauthorized access.
*   **DELETE /companies/{companyId}**
    *   **Success Response:** `204 No Content`.
    *   **Error Response:** `404 Not Found` if company not found, `403 Forbidden` for unauthorized access.
*   **POST /companies/{companyId}/customers**
    *   **Request Body:**
        ```json
        {
          "customerId": "string"
        }
        ```
    *   **Success Response:** `200 OK` with the updated company object.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if company not found, `403 Forbidden` for non-company users.
*   **GET /companies/customers/{customerId}**
    *   **Success Response:** `200 OK` with a list of companies.
*   **POST /companies/code**
    *   **Request Body:**
        ```json
        {
          "code": "string"
        }
        ```
    *   **Success Response:** `200 OK` with the company object.
    *   **Error Response:** `404 Not Found` if company not found.
*   **GET /companies/code/{code}**
    *   **Success Response:** `200 OK` with the company object.
    *   **Error Response:** `404 Not Found` if company not found.
*   **POST /companies/code/{code}/customers**
    *   **Success Response:** `200 OK` with the updated company object.
    *   **Error Response:** `404 Not Found` if company not found.

### 5.3. Product Service

*   **POST /products**
    *   **Request Body:**
        ```json
        {
          "name": "string",
          "description": "string",
          "price": "number",
          "companyId": "string"
        }
        ```
    *   **Success Response:** `201 Created` with the new product object.
    *   **Error Response:** `400 Bad Request` for invalid input, `403 Forbidden` for non-company users.
*   **GET /products**
    *   **Success Response:** `200 OK` with a list of products.
    *   **Error Response:** `403 Forbidden` for unauthorized access.
*   **GET /products/{productId}**
    *   **Success Response:** `200 OK` with the product object.
    *   **Error Response:** `404 Not Found` if product not found, `403 Forbidden` for unauthorized access.
*   **PUT /products/{productId}**
    *   **Request Body:**
        ```json
        {
          "name": "string",
          "description": "string",
          "price": "number"
        }
        ```
    *   **Success Response:** `200 OK` with the updated product object.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if product not found, `403 Forbidden` for unauthorized access.
*   **DELETE /products/{productId}**
    *   **Success Response:** `204 No Content`.
    *   **Error Response:** `404 Not Found` if product not found, `403 Forbidden` for unauthorized access.

### 5.4. Cart Service

*   **POST /cart**
    *   **Request Body:**
        ```json
        {
          "entity": {
            "productId": "string",
            "quantity": "number",
            "companyId": "string",
            "name": "string",
            "price": "number"
          }
        }
        ```
    *   **Success Response:** `200 OK` with the updated cart object.
    *   **Error Response:** `400 Bad Request` for invalid input, `403 Forbidden` for non-customer users.
*   **GET /cart**
    *   **Success Response:** `200 OK` with the cart object.
    *   **Error Response:** `400 Bad Request` for missing company ID.
*   **DELETE /cart**
    *   **Success Response:** `200 OK` with the cleared cart object.
    *   **Error Response:** `400 Bad Request` for missing company ID.
*   **PUT /cart/{itemId}**
    *   **Request Body:**
        ```json
        {
          "entity": {
            "quantity": "number"
          }
        }
        ```
    *   **Success Response:** `200 OK` with the updated cart object.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if item not found.
*   **DELETE /cart/{itemId}**
    *   **Success Response:** `200 OK` with the updated cart object.
    *   **Error Response:** `404 Not Found` if item not found.

### 5.5. Order Service

*   **POST /orders**
    *   **Request Body:**
        ```json
        {
          "entity": {
            "base_grand_total": "number",
            "grand_total": "number",
            "customer_email": "string",
            "billing_address": {
              "address_type": "string",
              "city": "string",
              "country_id": "string",
              "firstname": "string",
              "lastname": "string",
              "postcode": "string",
              "telephone": "string",
              "street": ["string"]
            },
            "payment": {
              "account_status": "string",
              "additional_information": ["string"],
              "cc_last4": "string",
              "method": "string"
            },
            "items": [
              {
                "sku": "string",
                "name": "string",
                "qty_ordered": "number",
                "price": "number",
                "row_total": "number"
              }
            ],
            "company_id": "string",
            "user_id": "string"
          }
        }
        ```
    *   **Success Response:** `201 Created` with the new order object.
    *   **Error Response:** `400 Bad Request` for invalid input, `403 Forbidden` for unauthorized users.
*   **GET /orders**
    *   **Success Response:** `200 OK` with a list of orders.
    *   **Error Response:** `403 Forbidden` for unauthorized access.
*   **GET /orders/{orderId}**
    *   **Success Response:** `200 OK` with the order object.
    *   **Error Response:** `404 Not Found` if order not found, `403 Forbidden` for unauthorized access.
*   **PUT /orders/{orderId}**
    *   **Request Body:** (Same as POST /orders, but all fields are optional)
    *   **Success Response:** `200 OK` with the updated order object.
    *   **Error Response:** `400 Bad Request` for invalid input, `404 Not Found` if order not found, `403 Forbidden` for unauthorized access.
*   **DELETE /orders/{orderId}**
    *   **Success Response:** `204 No Content`.
    *   **Error Response:** `404 Not Found` if order not found, `403 Forbidden` for unauthorized access.

### 5.6. Checkout Service

*   **POST /checkout**
    *   **Success Response:** `200 OK`.

### 5.7. Payment Service

*   **POST /payment**
    *   **Success Response:** `200 OK`.

### 5.8. Shipping Service

*   **POST /shipping**
    *   **Success Response:** `200 OK`.

### 5.9. Promotion Service

*   **POST /promotion**
    *   **Success Response:** `200 OK`.

### 5.10. Tax Service

*   **POST /tax**
    *   **Success Response:** `200 OK`.

## 6. User Roles and Permissions

*   **Admin:** Can manage all users, companies, and products.
*   **Company:** Can manage their own company profile, products, and orders. They can also manage their associated customers.
*   **Customer:** Can browse products, manage their cart, and place orders with their associated companies.

## 7. Authentication and Authorization

The application uses JSON Web Tokens (JWT) for authentication and authorization. The flow is as follows:

1.  A user logs in with their email and password.
2.  The **User Service** validates the credentials and generates an access token and a refresh token.
3.  The access token is sent to the client and stored in a cookie.
4.  The refresh token is stored in the database.
5.  For subsequent requests, the client sends the access token in the `Authorization` header.
6.  The **Authorizer Service** validates the access token and authorizes the request.
7.  If the access token is expired, the client can use the refresh token to obtain a new access token.

## 8. GitHub Workflows

*   **Code Quality:** This workflow runs on every push and pull request to the `main` branch. It performs the following checks:
    *   **Linting:** Runs ESLint on the `web-portal` to enforce code style and identify potential issues.
    *   **SonarQube Analysis:** Performs a static code analysis using SonarQube to detect bugs, vulnerabilities, and code smells.
*   **PR Pipeline:** This workflow runs on every pull request to the `main` and `staging` branches. It performs the following steps:
    *   **Build CDK Root:** Builds the root CDK project.
    *   **Build CDK + Microservices & CDK Synth:** Builds the CDK and all microservices, then synthesizes the CloudFormation templates.
    *   **Run Tests:** Runs unit tests for all microservices except the `web-portal`.

## 9. Local Development and Testing

### 9.1. `manage_services.sh`

This script is used to manage the local development environment. It provides the following commands:

*   `start`: Starts all the microservices using `sam local start-api`.
*   `stop`: Stops all the running microservices.
*   `restart`: Restarts all the microservices.

### 9.2. Test Scripts

*   **`test_customer_api_flow.sh`:** Tests the complete API flow for a customer, from registration to placing an order.
*   **`test_specific_company_api_flow.sh`:** Tests the API flow for a specific company, including creating products and managing orders.
*   **`test_user_role_api_chain.sh`:** Tests the API chain for different user roles (admin, company, customer).

### 9.3. Unit Tests

*   **`cart-service/tests/handler.test.ts`:** Tests the cart service handler, including adding, updating, and deleting cart items.
*   **`checkout-service/tests/handler.test.ts`:** Placeholder test for the checkout service.
*   **`company-service/tests/handler.test.ts`:** Tests the company service handler, including creating, updating, and deleting companies and customers.
*   **`order-service/tests/handler.test.ts`:** Tests the order service handler, including creating, updating, and deleting orders.
*   **`payment-service/tests/handler.test.ts`:** Placeholder test for the payment service.
*   **`product-service/tests/handler.test.ts`:** Tests the product service handler, including creating, updating, and deleting products.
*   **`promotion-service/tests/handler.test.ts`:** Placeholder test for the promotion service.
*   **`shipping-service/tests/handler.test.ts`:** Placeholder test for the shipping service.
*   **`tax-service/tests/handler.test.ts`:** Placeholder test for the tax service.
*   **`test/cdk-backend.test.ts`:** Placeholder test for the CDK backend stack.
*   **`user-service/tests/handler.test.ts`:** Tests the user service handler, including user registration, login, and token management.

## 10. Web Portal

### 10.1. Pages

*   **`Cart.tsx`:** Displays the user's shopping cart.
*   **`Catalog.tsx`:** Displays the product catalog.
*   **`Home.tsx`:** The home page of the application.

### 10.2. Components

*   **`AddToCartButton.tsx`:** A button for adding products to the cart.
*   **`CompanyForm.tsx`:** A form for creating and editing companies.
*   **`Dashboard.tsx`:** The main dashboard for company and admin users.
*   **`Login.tsx`:** The login form.
*   **`Navbar.tsx`:** The navigation bar.
*   **`OrderForm.tsx`:** A form for creating and editing orders.
*   **`ProductForm.tsx`:** A form for creating and editing products.
*   **`Register.tsx`:** The registration form.
*   **`Sidebar.tsx`:** The sidebar navigation for the dashboard.
*   **`UserForm.tsx`:** A form for creating and editing users.

## 11. Environment Variables

*   **`MONGO_URI`:** The connection string for the MongoDB database.
*   **`JWT_SECRET`:** The secret key for signing JWTs.
*   **`JWT_REFRESH_SECRET`:** The secret key for signing refresh JWTs.
*   **`NODE_ENV`:** The node environment (e.g., `development`, `production`).
*   **`USER_API`:** The URL for the User Service API.
*   **`COMPANY_API`:** The URL for the Company Service API.
*   **`PRODUCT_API`:** The URL for the Product Service API.
*   **`ORDER_API`:** The URL for the Order Service API.
*   **`CART_API`:** The URL for the Cart Service API.
*   **`CHECKOUT_API`:** The URL for the Checkout Service API.
*   **`PAYMENT_API`:** The URL for the Payment Service API.
*   **`SHIPPING_API`:** The URL for the Shipping Service API.
*   **`PROMOTION_API`:** The URL for the Promotion Service API.
*   **`TAX_API`:** The URL for the Tax Service API.

## 12. To-Do and Future Improvements

The following is a list of pending tasks and areas for improvement based on the `TODO` and `FIXME` comments found in the codebase:

*   **`bin/business-cart.ts`:**
    *   Replace placeholder API URLs with the actual outputs from the service stacks.
*   **General:**
    *   Improve error handling and logging across all services.
    *   Enhance the test coverage for all services.
    *   Consider adding a more robust solution for managing environment variables.
    *   Review and refactor the code to improve its quality and maintainability.

### 12.1. Placeholder Service Implementation Details

The following placeholder services require full implementation:

#### 12.1.1. Checkout Service

The `checkout-service` is intended to be the orchestrator of the entire checkout process. It should coordinate with various other services to finalize an order.

**Current State:** The service has a single endpoint that returns a static message. It does not interact with any other service.

**Next Development Steps:**

*   **Implement the Checkout Logic:**
    *   Retrieve the customer's cart from the `cart-service`.
    *   Create an order in the `order-service` with a "pending" status.
    *   Invoke the `payment-service` to process the payment.
    *   If payment is successful, invoke the `shipping-service` to arrange for shipping.
    *   Invoke the `promotion-service` to apply any discounts.
    *   Invoke the `tax-service` to calculate taxes.
    *   Update the order in the `order-service` with the final details (payment status, shipping information, taxes, etc.) and set the status to "processing".
    *   Clear the customer's cart in the `cart-service`.
    *   Return a success response to the user with the order confirmation.
*   **Error Handling and Rollbacks:** Implement robust error handling and transaction management. For example, if the payment fails, the order should be marked as "failed" and the process should stop. This might involve implementing a Saga pattern to ensure data consistency across microservices.
*   **API Endpoint:** The `POST /checkout` endpoint needs to be implemented to trigger the checkout orchestration logic.

#### 12.1.2. Payment Service

The `payment-service` is responsible for handling all payment-related operations.

**Current State:** Placeholder with a single endpoint that returns a success message.

**Next Development Steps:**

*   **Integrate with a Payment Gateway:** Choose and integrate with a third-party payment gateway like Stripe, Braintree, or Adyen. This will involve:
    *   Creating an account with the payment provider.
    *   Using their SDK or API to create payment intents, process payments, and handle webhooks.
*   **Implement Payment Processing Logic:**
    *   Create an endpoint (e.g., `POST /payment/charge`) that takes payment details (e.g., credit card information or a token from the payment gateway) and an amount.
    *   Call the payment gateway's API to process the payment.
    *   Handle successful payments and payment failures.
    *   Store transaction details in a dedicated `payments` collection in the database.
*   **Implement Webhooks:** Implement a webhook endpoint to receive asynchronous notifications from the payment gateway about payment status changes (e.g., chargebacks, refunds).
*   **Security:** Ensure that the service is PCI DSS compliant if you are handling credit card data directly. Using a service like Stripe where the payment information is tokenized on the client-side is highly recommended to reduce the security burden.

#### 12.1.3. Shipping Service

The `shipping-service` is responsible for all shipping and logistics.

**Current State:** Placeholder with a single endpoint that returns a success message.

**Next Development Steps:**

*   **Integrate with Shipping Carriers:** Integrate with shipping carrier APIs (e.g., FedEx, UPS, USPS) or a multi-carrier shipping API (e.g., Shippo, EasyPost).
*   **Implement Shipping Rate Calculation:**
    *   Create an endpoint (e.g., `POST /shipping/rates`) that takes the shipping address and the items in the order.
    *   Call the shipping carrier's API to get available shipping rates.
*   **Implement Shipment Creation:**
    *   Create an endpoint (e.g., `POST /shipping/shipments`) to create a shipment and generate a shipping label.
*   **Implement Shipment Tracking:**
    *   Implement an endpoint to get the tracking status of a shipment.
    *   Implement a mechanism to send shipping notifications to customers.

#### 12.1.4. Promotion Service

The `promotion-service` is responsible for managing discounts and promotions.

**Current State:** Placeholder with a single endpoint that returns a success message.

**Next Development Steps:**

*   **Implement Promotion Management:**
    *   Create a `promotions` collection in the a database to store promotion details (e.g., promo code, discount type, discount value, expiration date, usage limits).
    *   Create API endpoints for creating, retrieving, updating, and deleting promotions (e.g., `POST /promotions`, `GET /promotions/{code}`, etc.). These should be accessible to "Admin" users.
*   **Implement Promotion Application Logic:**
    *   Create an endpoint (e.g., `POST /promotions/apply`) that takes a promotion code and the order details.
    *   Validate the promotion code and apply the discount to the order total.
    *   The `checkout-service` will call this endpoint during the checkout process.

#### 12.1.5. Tax Service

The `tax-service` is responsible for calculating taxes.

**Current State:** Placeholder with a single endpoint that returns a success message.

**Next Development Steps:**

*   **Integrate with a Tax Calculation Service:** Integrate with a third-party tax service like Avalara, TaxJar, or Sovos.
*   **Implement Tax Calculation Logic:**
    *   Create an endpoint (e.g., `POST /tax/calculate`) that takes the order details (including the shipping address).
    *   Call the tax service's API to get the tax amount for the order.
    *   The `checkout-service` will call this endpoint during the checkout process.
# Product Requirements Document: BusinessCart

## 1. Introduction

This document outlines the product requirements for the BusinessCart application. BusinessCart is a B2B e-commerce platform designed to facilitate transactions between companies and their customers. The platform is built on a microservices architecture, with separate services for managing users, companies, products, and the checkout process. This document details the current state of the application, including its architecture, features, and areas for future development.

## 2. System Architecture

The BusinessCart application is built on a **serverless, cloud-native, and event-driven architecture**. It leverages AWS services for hosting and managing the different microservices. The entire infrastructure is defined using **Infrastructure as Code (IaC)** with the **AWS Cloud Development Kit (CDK)**, and the application is written in **TypeScript and Go**.

### 2.1. Architectural Principles

*   **Microservices:** The application is divided into small, independent services that can be developed, deployed, and scaled independently.
*   **Serverless:** The services are deployed as AWS Lambda functions, which allows for automatic scaling and pay-per-use pricing.
*   **Cloud-Native:** The application is designed to take full advantage of the benefits of cloud computing, such as scalability, reliability, and cost-effectiveness.
*   **Event-Driven:** The services communicate with each other through events, which allows for loose coupling and greater flexibility.
*   **Infrastructure as Code (IaC):** The entire infrastructure is defined as code using the AWS CDK, which allows for automated provisioning and management.
*   **TypeScript and Go:** The application is written in TypeScript and Go, which provides a balance of static typing, performance, and developer productivity.

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
                           |                 |----->| Checkout Service|
                           |                 |      +-----------------+
                           |                 |      +-----------------+
                           |                 |----->|  Payment Service|
                           +-----------------+      +-----------------+
```

### 2.3. Microservices

*   **User Service:** Manages user authentication, registration, and user data.
*   **Company Service:** Manages company profiles and customer associations.
*   **Product Service:** Manages product information, including pricing and inventory.
*   **Checkout Service:** Orchestrates the entire checkout process, including cart management, quoting, order creation, and integration with other services like payment, shipping, tax, and promotion.
*   **Payment Service:** Handles payment processing (placeholder).
*   **Web Portal:** The frontend application for users to interact with the platform.
*   **Authorizer Service:** Provides authorization for API Gateway endpoints.

## 3. Data Flow Example: Customer Places an Order

1.  The customer adds products to their cart from the **Web Portal**.
2.  The **Web Portal** sends a request to the **Checkout Service** to add the items to the cart.
3.  The customer proceeds to checkout.
4.  The **Web Portal** sends a request to the **Checkout Service** to create a quote.
5.  The **Checkout Service** retrieves the cart information, calculates taxes, shipping, and promotions, and creates a quote.
6.  The **Web Portal** displays the quote to the customer.
7.  The customer confirms the order.
8.  The **Web Portal** sends a request to the **Checkout Service** to place the order, including the `quoteId` and a `paymentToken`.
9.  The **Checkout Service** retrieves the quote, processes the payment through the **Payment Service**, and creates a permanent order.
10. The **Checkout Service** clears the cart and deletes the quote.
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

### 4.4. Checkout Service

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
*   **Quotes Collection:**
    *   `"cartId"`: `String` (required)
    *   `"userId"`: `String` (required)
    *   `"companyId"`: `String` (required)
    *   `"items"`: `[Object]`
    *   `"subtotal"`: `Number`
    *   `"shippingCost"`: `Number`
    *   `"taxAmount"`: `Number`
    *   `"grandTotal"`: `Number`
    *   `"createdAt"`: `Date`
    *   `"expiresAt"`: `Date`
*   **Orders Collection:**
    *   `"quoteId"`: `String` (required)
    *   `"userId"`: `String` (required)
    *   `"companyId"`: `String` (required)
    *   `"items"`: `[Object]`
    *   `"subtotal"`: `Number`
    *   `"shippingCost"`: `Number`
    *   `"taxAmount"`: `Number`
    *   `"grandTotal"`: `Number`
    *   `"payment"`: `Object`
        *   `"transactionId"`: `String`
    *   `"createdAt"`: `Date`

## 5. API Endpoints

### 5.1. User Service

*   **POST /users/register**
*   **POST /users/login**
*   **POST /users/refresh**
*   **POST /users/logout**
*   **POST /users/associate-company**
*   **GET /users**
*   **GET /users/{id}**
*   **PATCH /users/{id}**
*   **DELETE /users/{id}**
*   **PUT /users/{id}**

### 5.2. Company Service

*   **POST /companies**
*   **GET /companies**
*   **GET /companies/{companyId}**
*   **PUT /companies/{companyId}**
*   **DELETE /companies/{companyId}**
*   **POST /companies/{companyId}/customers**
*   **GET /companies/customers/{customerId}**
*   **POST /companies/code**
*   **GET /companies/code/{code}**
*   **POST /companies/code/{code}/customers**

### 5.3. Product Service

*   **POST /products**
*   **GET /products**: For customers, this endpoint automatically returns products filtered by the `associate_company_ids` in their JWT.
*   **GET /products/{productId}**
*   **PUT /products/{productId}**
*   **DELETE /products/{productId}**

### 5.4. Checkout Service

*   **POST /cart**
*   **GET /cart**
*   **DELETE /cart**
*   **PUT /cart/{itemId}**
*   **DELETE /cart/{itemId}**
*   **POST /quotes**
*   **GET /quotes/{quoteId}**
*   **POST /orders**

### 5.5. Payment Service

*   **POST /payment**

## 6. User Roles and Permissions

*   **Admin:** Can manage all users, companies, and products.
*   **Company:** Can manage their own company profile, products, and orders. They can also manage their associated customers.
*   **Customer:** Can browse products, manage their cart, and place orders with their associated companies.

## 7. Authentication and Authorization

The application uses JSON Web Tokens (JWT) for authentication and authorization.

## 8. GitHub Workflows

*   **Code Quality:** Lints the `web-portal` and runs SonarQube analysis.
*   **PR Pipeline:** Builds and tests the CDK and all microservices.

## 9. Local Development and Testing

### 9.1. `manage_services.sh`

*   `start`: Starts all the microservices.
*   `stop`: Stops all the running microservices.
*   `restart`: Restarts all the microservices.

### 9.2. Test Scripts

*   **`test_customer_api_flow.sh`:** Tests the complete API flow for a customer.
*   **`test_specific_company_api_flow.sh`:** Tests the API flow for a specific company.
*   **`test_user_role_api_chain.sh`:** Tests the API chain for different user roles.

### 9.3. Unit Tests

*   **`checkout-service/internal/checkout/service_test.go`:** Tests for the checkout service.
*   **`company-service/tests/handler.test.ts`:** Tests for the company service.
*   **`product-service/tests/handler.test.ts`:** Tests for the product service.
*   **`payment-service/tests/handler.test.ts`:** Placeholder test for the payment service.
*   **`test/cdk-backend.test.ts`:** Placeholder test for the CDK backend stack.
*   **`user-service/tests/handler.test.ts`:** Tests for the user service.

## 10. Web Portal

### 10.1. Pages

*   **`Cart.tsx`**
*   **`Catalog.tsx`**: Displays a filterable catalog of products. For customers, it fetches all products they are authorized to see and then allows for client-side filtering by company. The filter defaults to the first company in the user's list.
*   **`Home.tsx`**

### 10.2. Components

*   **`AddToCartButton.tsx`**
*   **`CompanyForm.tsx`**
*   **`Dashboard.tsx`**
*   **`Login.tsx`**
*   **`Navbar.tsx`**
*   **`OrderForm.tsx`**
*   **`ProductForm.tsx`**
*   **`Register.tsx`**
*   **`Sidebar.tsx`**
*   **`UserForm.tsx`**

## 11. Android App

A native Android application is available for customers. It provides a mobile-friendly experience for browsing the product catalog and managing their account.

### 11.1. Features

*   User login and session management.
*   Product catalog view, filtered by the user's associated companies.
*   Add products to the shopping cart.
*   View the shopping cart for each associated company.
*   A consistent user interface with a teal color theme that matches the web portal.

### 11.2. Key Components

*   **`MainActivity.kt`**: The main screen for the product catalog.
*   **`CartActivity.kt`**: Displays the user's shopping cart.
*   **`LoginActivity.kt`**: Handles user authentication.
*   **`DataModels.kt`**: Defines the data structures for the application.

## 12. Environment Variables

*   **`MONGO_URI`**
*   **`JWT_SECRET`**
*   **`JWT_REFRESH_SECRET`**
*   **`NODE_ENV`**
*   **`USER_API`**
*   **`COMPANY_API`**
*   **`PRODUCT_API`**
*   **`CHECKOUT_API`**
*   **`PAYMENT_API`**

## 13. Before Production Launch

This section outlines critical and highly recommended changes that must be addressed across all services before the application is deployed to a production environment. The following issues were identified during a production readiness review.

### 13.1. Infrastructure Readiness (AWS CDK)

These issues apply to the CDK stacks for `account-service`, `catalog-service`, and `checkout-service`.

*   **Critical: Insecure Secret Management**
    *   **Issue:** Secrets (`MONGO_URI`, `JWT_SECRET`) are loaded from `.env` files at deployment time and stored in Lambda environment variables. This is a major security risk.
    *   **Recommendation:** Store all secrets in **AWS Secrets Manager** or **AWS Systems Manager Parameter Store (SecureString)**. The Lambda execution roles should be granted IAM permissions to read these secrets at runtime.

*   **High: Lack of Multi-Stage Environments**
    *   **Issue:** The stacks have hardcoded values for development (e.g., `NODE_ENV: 'development'`, `stageName: 'dev'`). This prevents proper deployment to multiple environments like staging and production.
    *   **Recommendation:** Parameterize the CDK stacks to accept a `stage` or `environment` prop. This will allow for deploying different configurations (e.g., memory, timeouts, environment variables) for each environment.

*   **High: Insufficient Observability**
    *   **Issue:** API Gateway and Lambda functions lack essential monitoring, logging, and tracing configurations. This makes debugging and monitoring in production extremely difficult.
    *   **Recommendation:**
        *   **API Gateway:** Enable access logging, CloudWatch metrics, and AWS X-Ray tracing in the `deployOptions`.
        *   **Lambda:** Configure a **Dead-Letter Queue (DLQ)** for each function to capture failed invocations. Enable AWS X-Ray tracing to analyze performance bottlenecks.

*   **Medium: Overly Permissive CORS**
    *   **Issue:** The API Gateways are configured with `allowOrigins: ['*']` or `apigw.Cors.ALL_ORIGINS`, which is too permissive for production.
    *   **Recommendation:** Restrict the allowed origins to the specific domain of the web portal.

*   **Medium: Checkout Service Architecture ("Mono-Lambda")**
    *   **Issue:** The `checkout-service` uses a single Lambda function for multiple, distinct concerns (`/cart`, `/quotes`, `/orders`).
    *   **Recommendation:** For better scalability, security (least privilege), and separation of concerns, refactor the `checkout-service` into multiple Lambda functions, each handling a specific resource (e.g., a `CartHandler`, `QuoteHandler`, `OrderHandler`).

### 13.2. Application Readiness (Go Services)

These issues apply to the Go application code in `account-service`, `catalog-service`, and `checkout-service`.

*   **Critical: Open Admin Registration Endpoint**
    *   **Issue:** The `account-service` has a public endpoint that allows anyone to register as an "admin". This is a critical security vulnerability.
    *   **Recommendation:** **Immediately remove this functionality.** Admin users must only be created through a secure, out-of-band process (e.g., a secure script, manual database entry, or an internal tool with strict access controls).

*   **High: Lack of Structured Logging**
    *   **Issue:** Services use the basic `log` package or have no logging at all. This produces unstructured logs that are difficult to search, filter, and analyze in CloudWatch.
    *   **Recommendation:** Implement a **structured logging library** like `zerolog` or `zap`. Logs should be in JSON format and include contextual information like `request_id`, `service_name`, and `log_level`.

*   **High: Inconsistent and Unsafe Error Handling**
    *   **Issue:** Errors are often ignored using the blank identifier (`_`), and error responses are simple strings that can leak internal details.
    *   **Recommendation:**
        *   **Never ignore errors.** Every error must be logged and handled appropriately.
        *   Implement a standardized JSON error response format across all APIs (e.g., `{ "error": { "code": "...", "message": "..." } }`).

*   **High: Missing Input Validation**
    *   **Issue:** Incoming request bodies and parameters are not validated. This can lead to data corruption, application crashes, and security vulnerabilities.
    *   **Recommendation:** Use a validation library (e.g., `go-playground/validator`) to validate all incoming data against predefined rules (e.g., required fields, email format, password complexity).

*   **Medium: Scattered Authorization Logic**
    *   **Issue:** Authorization checks (e.g., checking user roles) are duplicated and mixed with business logic inside each handler. This is error-prone and hard to maintain.
    *   **Recommendation:** Refactor authorization logic into reusable, composable **middleware**. For example, create `AdminOnly` or `CompanyOrAdmin` middleware that can be applied to specific routes.

*   **Medium: Hardcoded Business Logic**
    *   **Issue:** The `checkout-service` contains hardcoded business logic, such as tax rates and shipping costs.
    *   **Recommendation:** Externalize this logic. It should be configurable and potentially managed by separate, dedicated services (e.g., `TaxService`, `ShippingService`).

## 14. To-Do and Future Improvements

*   **`bin/business-cart.ts`:**
    *   Replace placeholder API URLs with the actual outputs from the service stacks.
*   **General:**
    *   Improve error handling and logging across all services.
    *   Enhance the test coverage for all services.
    *   Consider adding a more robust solution for managing environment variables.
    *   Review and refactor the code to improve its quality and maintainability.

### 14.1. Placeholder Service Implementation Details

The following placeholder services require full implementation:

#### 14.1.1. Checkout Service

The `checkout-service` is the orchestrator of the entire checkout process. It should coordinate with various other services to finalize an order.

**Current State:** The service handles cart management, quoting, and order creation. It also includes placeholder logic for tax, shipping, and promotions.

**Next Development Steps:**

*   **Implement Full Tax, Shipping, and Promotion Logic:**
    *   Integrate with third-party services for tax calculation (e.g., Avalara, TaxJar), shipping rates (e.g., Shippo, EasyPost), and promotion management.
*   **Error Handling and Rollbacks:** Implement robust error handling and transaction management. For example, if the payment fails, the order should be marked as "failed" and the process should stop. This might involve implementing a Saga pattern to ensure data consistency across microservices.

#### 14.1.2. Payment Service

The `payment-service` is responsible for handling all payment-related operations.

**Current State:** Placeholder with a single endpoint that returns a success message.

**Next Development Steps:**

*   **Integrate with a Payment Gateway:** Choose and integrate with a third-party payment gateway like Stripe, Braintree, or Adyen.
*   **Implement Payment Processing Logic:**
    *   Create an endpoint (e.g., `POST /payment/charge`) that takes payment details and an amount.
    *   Call the payment gateway's API to process the payment.
    *   Handle successful payments and payment failures.
    *   Store transaction details in a dedicated `payments` collection in the database.
*   **Implement Webhooks:** Implement a webhook endpoint to receive asynchronous notifications from the payment gateway about payment status changes.
*   **Security:** Ensure that the service is PCI DSS compliant if handling credit card data directly.

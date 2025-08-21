# Checkout Service

The Checkout Service is a comprehensive component of the Business Cart platform that orchestrates the entire checkout process. It consolidates the functionalities of several previously separate services to provide a streamlined and efficient checkout experience.

## Business Logic

### Consolidated Services

The Checkout Service integrates the following functionalities:

-   **Cart Management:** Allows users to add, update, and remove items from their shopping cart. Each cart is specific to a user and a company.
-   **Quote Generation:** Enables users to create a quote from their shopping cart. The quote provides a detailed breakdown of costs, including subtotal, estimated shipping, and taxes.
-   **Order Placement:** Facilitates the conversion of a quote into a formal order after successful payment processing.
-   **Payment Processing:** Simulates payment processing through various gateways.
-   **Shipping Calculation:** Calculates estimated shipping costs.
-   **Tax Calculation:** Calculates applicable taxes.
-   **Promotion Application:** Applies promotional discounts to the order.

### Checkout Flow

The checkout process is a two-step flow designed to be simple and transparent for the user:

1.  **Create a Quote:**
    -   The user initiates the checkout process by requesting a quote based on the items in their shopping cart for a specific company.
    -   The service calculates the subtotal, adds estimated shipping costs and taxes, and applies any valid promotions to generate a comprehensive quote.
    -   The quote is saved with an expiration time, giving the user a window to review and confirm the details before placing an order.

2.  **Place an Order:**
    -   To complete the purchase, the user places an order using the generated `quoteId`.
    -   The user provides their desired payment method and a payment token.
    -   The service's payment module processes the payment.
    -   Upon successful payment, a new order is created with a unique transaction ID.
    -   The user's cart for that specific company is then cleared, and the quote is marked as fulfilled.

### Authentication and Authorization

All API endpoints exposed by the Checkout Service are protected and require a valid JSON Web Token (JWT) for authentication. The JWT is used to identify the user, their role, and their associated companies, ensuring that users can only access and manage their own carts, quotes, and orders.

### Data Storage

The Checkout Service uses MongoDB for data persistence. It maintains the following collections:

-   **`carts`:** Stores the shopping carts for each user and company.
-   **`quotes`:** Stores the generated quotes, including all cost components and expiration details.
-   **`orders`:** Stores the final orders, including payment and transaction details.

## API Endpoints

The Checkout Service exposes the following API endpoints:

-   **Cart:**
    -   `POST /cart`: Adds an item to the cart.
    -   `GET /cart`: Retrieves the user's cart for a specific company.
    -   `PUT /cart/{itemId}`: Updates the quantity of an item in the cart.
    -   `DELETE /cart/{itemId}`: Removes an item from the cart.
    -   `DELETE /cart`: Clears all items from the cart for a specific company.
-   **Quotes:**
    -   `POST /quotes`: Creates a new quote from the user's cart.
    -   `GET /quotes/{quoteId}`: Retrieves the details of a specific quote.
-   **Orders:**
    -   `POST /orders`: Places a new order using a `quoteId`.
    -   `GET /orders`: Retrieves a list of the user's past orders.

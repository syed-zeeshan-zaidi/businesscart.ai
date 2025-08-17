# Web Portal

The Web Portal is the front-end application for the Business Cart platform, providing a user-friendly interface for all user roles to interact with the system. It is built as a single-page application (SPA) using React.

## Business Logic

The Web Portal is designed to serve the distinct needs of each user role, providing a tailored experience for administrators, companies, and customers.

### Core Functionalities

-   **Authentication:** Users can register for a new account or log in with their existing credentials. The application uses JSON Web Tokens (JWT) for session management, ensuring secure communication with the backend services. An Axios interceptor is used to automatically attach the JWT to all API requests and to handle token expiration and unauthorized access by redirecting the user to the login page.
-   **Routing:** The application uses React Router for navigation. Protected routes are implemented to prevent unauthorized access to sensitive areas. Based on their role, users are automatically redirected to the appropriate dashboard or home page after logging in.

### Role-Specific Features

-   **Admin View:**
    -   **Dashboard:** Provides an overview of the platform.
    -   **User Management:** Admins can view and manage all user accounts.
    -   **Product Management:** Admins have read-only access to all products on the platform.
    -   **Order Management:** Admins can view and manage all orders.

-   **Company View:**
    -   **Dashboard:** Displays key information and metrics relevant to the company.
    -   **Product Management:** Companies can create, read, update, and delete their own products.
    -   **Order Management:** Companies can view and manage orders placed by their customers.

-   **Customer View:**
    -   **Home Page:** The landing page for customers.
    -   **Product Catalog:** Customers can browse and view products from the companies they are associated with.
    -   **Shopping Cart:** A fully functional shopping cart that allows customers to add, update, and remove items. The cart is segmented by company, so a customer can manage separate carts for each company they are buying from.
    -   **Checkout Process:** A two-step checkout process:
        1.  **Create Quote:** The customer first generates a quote from their cart, which provides a detailed breakdown of costs, including subtotal, shipping, and taxes.
        2.  **Place Order:** The customer then reviews the quote and proceeds to payment to place the order.
    -   **Order History:** Customers can view their past orders.

### Backend Integration

The Web Portal communicates with the following backend microservices via a RESTful API:

-   **Account Service:** For user registration, login, and account management.
-   **Product Service:** For managing and retrieving product information.
-   **Checkout Service:** For all checkout-related functionalities, including cart management, quote generation, and order placement.

## Getting Started

To run the Web Portal locally, follow these steps:

1.  Install the dependencies:
    ```bash
    npm install
    ```
2.  Set up the environment variables in a `.env` file. You will need to provide the URLs for the backend services:
    ```
    VITE_ACCOUNT_API_URL=http://localhost:3000
    VITE_PRODUCT_API_URL=http://localhost:3002
    VITE_CHECKOUT_API_URL=http://localhost:3009
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open your browser and navigate to the provided local URL.

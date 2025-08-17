# Product Service

The Product Service is a key component of the Business Cart platform, responsible for managing the lifecycle of products. It provides a secure and role-based API for creating, retrieving, updating, and deleting products.

## Business Logic

### Authentication and Authorization

The service is secured using a JSON Web Token (JWT) based Lambda authorizer. Before any API endpoint is accessed, the authorizer validates the user's JWT, extracts their identity and role, and passes this information to the handler in the request context. This ensures that all operations are authenticated and authorized.

### Role-Based Access Control (RBAC)

The Product Service implements a strict role-based access control model to govern what actions users can perform:

-   **Company Role:**
    -   Can **create** new products. Each new product is automatically associated with the company's `userId` and `companyId`.
    -   Can **read**, **update**, and **delete** only the products that they have created. They are not able to view or modify products belonging to other companies.

-   **Customer Role:**
    -   Can **read** products from the companies they are associated with. The list of associated companies is determined from the `associate_company_ids` field in their JWT.
    -   They do not have permission to create, update, or delete any products.

-   **Admin Role:**
    -   Has read-only access to **all** products across the entire platform.
    -   This role is intended for system-wide auditing and management.

### Data Storage

Product information is stored in a MongoDB database. The `Product` model includes the following key fields:

-   `name`: The name of the product.
-   `description`: A detailed description of the product.
-   `price`: The price of the product.
-   `companyId`: The ID of the company that owns the product.
-- `userId`: The ID of the user (from the company) who created the product.

This structure ensures that each product is clearly tied to its owner.

## API Endpoints

The Product Service exposes a RESTful API for product management:

-   `POST /products`: Creates a new product. (Requires `company` role).
-   `GET /products`: Retrieves a list of products. The returned list depends on the user's role (`company` sees their own, `customer` sees associated, `admin` sees all).
-   `GET /products/{productId}`: Retrieves a single product by its ID. (Requires ownership).
-   `PUT /products/{productId}`: Updates a product's details. (Requires ownership).
-   `DELETE /products/{productId}`: Deletes a product. (Requires ownership).

# Product Requirements Document (PRD) for Catalog Service

## 1. Overview

The Catalog Service is a core microservice within the BusinessCart platform responsible for managing the lifecycle of products. It provides a centralized system for companies to create, update, retrieve, and delete their product listings. The service also allows customers and administrators to view products based on their roles and permissions.

## 2. User Roles & Permissions

The service interacts with three main user roles, each with distinct permissions:

| Role      | Create | Read (Own) | Read (All) | Read (Associated) | Update | Delete |
| :-------- | :----: | :--------: | :--------: | :---------------: | :----: | :----: |
| **Admin**   |   -    |     -      |     ✅     |         -         |   -    |   -    |
| **Company** |   ✅   |     ✅     |     -      |         -         |   ✅   |   ✅   |
| **Customer**|   -    |     -      |     -      |         ✅        |   -    |   -    |

-   **Admin:** Can view all products across all companies for administrative and support purposes.
-   **Company:** Can manage their own product catalog (create, read, update, delete). They cannot see products from other companies.
-   **Customer:** Can view products from companies they are associated with.

## 3. Functional Requirements

### 3.1. Product Data Model

The core entity is the `Product`. The following attributes define a product:

| Field         | Type   | Description                                     | Required |
| :------------ | :----- | :---------------------------------------------- | :------: |
| `_id`         | `ObjectID` | Unique identifier for the product.              |    ✅    |
| `name`        | `string` | The name of the product.                        |    ✅    |
| `description` | `string` | A detailed description of the product.          |    -     |
| `price`       | `number` | The price of the product. Must be non-negative. |    ✅    |
| `accountID`   | `string` | The ID of the 'company' account that owns this product. |    ✅    |
| `image`       | `string` | A URL to an image of the product.               |    -     |
| `createdAt`   | `Date`   | Timestamp of when the product was created.      |    ✅    |
| `updatedAt`   | `Date`   | Timestamp of the last update.                   |    ✅    |

### 3.2. API Endpoints

The service will expose a RESTful API for managing products.

#### `POST /catalogs`

-   **Description:** Creates a new product.
-   **Authorization:** `Company` role required.
-   **Request Body:**
    ```json
    {
      "name": "string",
      "price": "number",
      "description": "string",
      "image": "string"
    }
    ```
-   **Success Response:** `201 Created` with the newly created product object.
-   **Error Responses:**
    -   `400 Bad Request`: Invalid request body or validation failure.
    -   `401 Unauthorized`: Missing or invalid authentication token.
    -   `403 Forbidden`: User does not have the 'company' role.

#### `GET /catalogs`

-   **Description:** Retrieves a list of products based on the user's role.
-   **Authorization:** `Admin`, `Company`, or `Customer` role required.
-   **Behavior:**
    -   **Admin:** Returns all products from all companies.
    -   **Company:** Returns all products owned by the company (`accountID` matches the user's ID).
    -   **Customer:** Returns all products from companies the customer is associated with.
-   **Success Response:** `200 OK` with an array of product objects.
-   **Error Responses:**
    -   `401 Unauthorized`: Missing or invalid authentication token.
    -   `403 Forbidden`: User role is not permitted.

#### `GET /catalogs/{catalogId}`

-   **Description:** Retrieves a single product by its ID.
-   **Authorization:** `Company` role required.
-   **Behavior:** The user can only retrieve a product if their `accountID` matches the product's `accountID`.
-   **Success Response:** `200 OK` with the product object.
-   **Error Responses:**
    -   `401 Unauthorized`: Missing or invalid authentication token.
    -   `403 Forbidden`: User is not the owner of the product.
    -   `404 Not Found`: Product with the specified ID does not exist.

#### `PUT /catalogs/{catalogId}`

-   **Description:** Updates an existing product.
-   **Authorization:** `Company` role required.
-   **Behavior:** The user can only update a product if their `accountID` matches the product's `accountID`.
-   **Request Body:** A partial product object with fields to update.
-   **Success Response:** `200 OK` with the updated product object.
-   **Error Responses:**
    -   `400 Bad Request`: Invalid request body.
    -   `401 Unauthorized`: Missing or invalid authentication token.
    -   `403 Forbidden`: User is not the owner of the product.
    -   `404 Not Found`: Product with the specified ID does not exist.

#### `DELETE /catalogs/{catalogId}`

-   **Description:** Deletes a product.
-   **Authorization:** `Company` role required.
-   **Behavior:** The user can only delete a product if their `accountID` matches the product's `accountID`.
-   **Success Response:** `204 No Content`.
-   **Error Responses:**
    -   `401 Unauthorized`: Missing or invalid authentication token.
    -   `403 Forbidden`: User is not the owner of the product.
    -   `404 Not Found`: Product with the specified ID does not exist.

## 4. Non-Functional Requirements

-   **Performance:** API responses should be returned in under 500ms.
-   **Scalability:** The service should be able to handle a growing number of products and requests.
-   **Security:** All endpoints must be secured and require a valid JWT. Role-based access control must be strictly enforced.
-   **Database:** The service will use MongoDB to store product data.

## 5. CDK Stack Details

-   **Lambda Runtime:** The service will be deployed as an AWS Lambda function using the `Go 1.x` runtime.
-   **API Gateway:** An Amazon API Gateway will be used to expose the Lambda function as a RESTful API.
-   **Authorizer:** A custom Lambda authorizer will be used to validate JWTs and enforce role-based access control. This will be a separate Go Lambda function.
-   **Deployment:** The entire stack will be defined and deployed using the AWS CDK. The `CatalogServiceStack` will be updated to reflect the change from Node.js to Go, including build and bundling options.

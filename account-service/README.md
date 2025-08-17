# Account Service

The Account Service is a core component of the Business Cart platform, responsible for managing user accounts, authentication, and authorization. It provides a secure and scalable solution for handling user data and controlling access to the platform's features.

## Business Logic

### User Roles

The Account Service defines four distinct user roles, each with specific permissions and functionalities:

-   **Admin:** Administrators have the highest level of access and can manage all aspects of the system, including creating codes, managing user accounts, and configuring system settings.
-   **Company:** Company users represent businesses that sell products or services on the platform. They can manage their company profile, product listings, and view their associated customer accounts.
-   **Customer:** Customer users are the end-users who purchase products or services from companies. They can manage their personal information, view their order history, and interact with the companies they are associated with.
-   **Partner:** Partner users are third-party entities that collaborate with the platform, such as resellers or affiliates. They have specific functionalities related to their partnership agreements.

### Codes and Registration

The registration process is designed to be flexible and secure, utilizing a system of codes to associate users with each other and with specific entities on the platform.

-   **`companyCode`:** A unique code assigned to each company. This code is required for a user to register as a `company` account. Upon registration, the `companyCode` is marked as "claimed" and cannot be used again.
-   **`customerCode`:** A code that links a `customer` account to one or more `company` accounts. Customers must provide at least one valid `customerCode` during registration. Unlike `companyCode`s, `customerCode`s are never marked as "claimed" and can be used by multiple customers.
-   **`partnerCode`:** An optional code that can be used during the registration of a `partner` account. If provided, it associates the partner with a specific program or campaign.

Admins are responsible for generating and distributing these codes.

### Authentication and Authorization

The Account Service uses JSON Web Tokens (JWT) for secure authentication and authorization.

-   **Authentication:** When a user successfully logs in, the service generates two tokens:
    -   **Access Token:** A short-lived token that grants the user access to protected resources. It is included in the header of each API request.
    -   **Refresh Token:** A long-lived token that can be used to obtain a new access token without requiring the user to re-enter their credentials.
-   **Authorization:** The service implements role-based access control (RBAC). API endpoints are protected by a middleware that validates the access token and checks the user's role before granting access to the requested resource. This ensures that users can only perform actions that are permitted for their role.

### Data Storage

The Account Service uses MongoDB to store its data. The database is organized into the following collections:

-   **`accounts`:** Stores user account information, including personal details, hashed passwords, roles, and role-specific data.
-   **`codes`:** Stores the `companyCode`s, `customerCode`s, and `partnerCode`s used for registration.
-   **`refreshtokens`:** Stores the refresh tokens issued to users.
-   **`blacklistedtokens`:** Stores tokens that have been invalidated, such as after a user logs out.

## API Endpoints

The Account Service exposes the following API endpoints:

-   `POST /accounts/register`: Creates a new user account.
-   `POST /accounts/login`: Authenticates a user and returns an access token and a refresh token.
-   `GET /accounts`: Retrieves a list of user accounts. The results are filtered based on the role of the authenticated user.
-   `GET /accounts/{id}`: Retrieves the details of a specific user account.
-   `PATCH /accounts/{id}`: Updates the details of a specific user account.
-   `DELETE /accounts/{id}`: Deletes a user account.
-   `POST /codes`: Creates a new registration code (admin only).
-   `GET /codes/{code}`: Retrieves the details of a specific registration code (admin only).

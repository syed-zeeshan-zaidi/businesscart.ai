# PRD: Account Service Migration (Simplified)

This document outlines the plan, requirements, and progress for migrating the existing `user-service` and `company-service` into a single, unified `account-service` with a simplified API.

## 1. Overview

The goal is to consolidate user and company management into a single Go-based microservice with a streamlined API. This will simplify the architecture, reduce maintenance, and improve cost-effectiveness. The new design uses a single `/accounts` resource to manage both users and companies.

## 2. Database Schema

The service uses two main collections in MongoDB: `accounts` and `codes`.

### `accounts` Collection

Stores the unified account information for all roles (`admin`, `company`, `customer`, `partner`).

```go
type Account struct {
	ID            primitive.ObjectID `bson:"_id,omitempty"`
	Name          string             `bson:"name"`
	Email         string             `bson:"email"`
	Password      string             `bson:"password"`
	Role          string             `bson:"role"`
	AccountStatus AccountStatus      `bson:"accountStatus"`
	CreatedAt     time.Time          `bson:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt"`

	// Role-specific embedded documents
	CompanyData  *CompanyData  `bson:"company,omitempty"`
	CustomerData *CustomerData `bson:"customer,omitempty"`
	PartnerData  *PartnerData  `bson:"partner,omitempty"`
	Address      *Address      `bson:"address,omitempty"`
}
```

-   **`CompanyData`**: Contains company-specific fields, including a `Status` field (e.g., `pending_setup`, `active`).
-   **`CustomerData`**: Contains customer-specific data, including a list of `CustomerCodes` they are associated with.
-   **`PartnerData`**: Contains partner-specific information.

### `codes` Collection

Stores registration codes created by an Admin.

```go
type Code struct {
	ID           primitive.ObjectID `bson:"_id,omitempty"`
	CompanyCode  string             `bson:"companyCode"`
	CustomerCode string             `bson:"customerCode"`
	PartnerCode  string             `bson:"partnerCode,omitempty"`
	IsClaimed    bool               `bson:"is_claimed"`
	CreatedAt    time.Time          `bson:"createdAt"`
}
```

-   `CompanyCode`: Used once by a `company` to register.
-   `CustomerCode`: Used by `customer`s to associate with a company. Can be used multiple times.
-   `PartnerCode`: Used once by a `partner` to register.

## 3. Implemented API Endpoints

The service exposes the following endpoints:

*   **`POST /accounts/register`**: Creates a new account. The logic varies based on the `role` provided.
*   **`POST /accounts/login`**: Authenticates a user and returns an access token and a refresh token.
*   **`GET /accounts`**: Retrieves a list of accounts. Results are filtered based on the caller's role (e.g., an Admin sees all, a Company sees their associated customers).
*   **`GET /accounts/{id}`**: Retrieves the details of a specific account.
*   **`PATCH /accounts/{id}`**: Updates the details of a specific account. This is a generic update endpoint.
*   **`DELETE /accounts/{id}`**: Deletes an account.
*   **`POST /codes`** (Admin Only): Creates a new registration code document containing a `CompanyCode` and `CustomerCode`.
*   **`GET /codes/{code}`** (Admin Only): Retrieves the details of a specific registration code.

## 4. Registration & Operational Flow

The registration process is managed by admins and relies on the `codes` collection.

1.  **Admin Creates Codes**: An admin uses the `POST /codes` endpoint to create a new code document. This document contains a unique `CompanyCode` and a `CustomerCode`.

2.  **Company Registration**:
    *   A user registers with `role: "company"` and provides a valid, unclaimed `companyCode`.
    *   The system validates the code in the `codes` collection.
    *   If valid, a new `company` account is created with a `status` of `pending_setup`.
    *   The `companyCode` is marked as `is_claimed: true`.
    *   The company can then be updated (e.g., to `active` status) via the `PATCH /accounts/{id}` endpoint.

3.  **Customer Registration**:
    *   A new user registers with `role: "customer"` and provides one or more `customerCodes`.
    *   The system finds the corresponding code documents to associate the new customer with the correct company/companies.
    *   `customerCode`s are never marked as claimed and can be used by multiple customers.

4.  **Partner Registration**:
    *   A user registers with `role: "partner"` and can optionally provide a `partnerCode`.
    *   If provided, the `partnerCode` is validated and marked as `is_claimed: true`.

## 5. Migration Plan & Progress

This checklist tracks the historical progress of the service migration.

### Phase 1: Planning & Setup

- [x] Create `account-service` directory.
- [x] Create this `PRD.md` document.
- [x] Create `new_full_api_test.sh` to define the new API flow.
- [x] Discard previous code changes in `account-service` and start fresh based on this new plan.
- [x] Implement the new, simplified data models in `storage/models.go`.
- [x] Implement the `POST /accounts` (register) endpoint with logic for all roles.
- [x] Implement the `POST /accounts/login` endpoint.

### Phase 2: Core Logic Implementation

- [x] Implement the `POST /accounts` (register) endpoint with logic for all roles.
- [x] Implement the `POST /accounts/login` endpoint.
- [x] Implement the `GET /accounts` endpoint with role-based filtering.
- [x] Implement the `GET /accounts/{id}` endpoint.
- [x] Implement the `PATCH /accounts/{id}` endpoint with role-based update logic.
- [x] Implement the `DELETE /accounts/{id}` endpoint with role-based deletion logic.

### Phase 3: CDK & Deployment

- [x] Create a new CDK stack `lib/account-service-stack.ts`.
- [x] Define the Lambda, API Gateway, and database resources for the unified service.
- [x] Ensure the API Gateway routes match the simplified endpoint list.

### Phase 4: Testing & Cleanup

- [ ] **(Next)** Run the `new_full_api_test.sh` script and verify all functionality.
- [ ] Remove the old `user-service` and `company-service` directories and their stacks.
- [ ] Update `bin/business-cart.ts` to use only the new `account-service-stack`.

# PRD: Account Service Migration (Simplified)

This document outlines the plan, requirements, and progress for migrating the existing `user-service` and `company-service` into a single, unified `account-service` with a simplified API.

## 1. Overview

The goal is to consolidate user and company management into a single Go-based microservice with a streamlined API. This will simplify the architecture, reduce maintenance, and improve cost-effectiveness. The new design uses a single `/accounts` resource to manage both users and companies.

## 2. Database Schema

The `accounts` collection will store documents with the following structures.

### Account Document (`type: "USER"` or `type: "COMPANY"`)

```json
{
  "_id": "<ObjectID>",
  "type": "string", // "USER" or "COMPANY"
  "name": "string",
  "createdAt": "<ISODate>",
  "updatedAt": "<ISODate>",

  // User-specific fields
  "email": "string (unique, for users)",
  "passwordHash": "string (for users)",
  "role": "string (admin, company, customer)",
  "phoneNumber": "string",
  "associateCompanyIds": ["<ObjectID>"],

  // Company-specific fields
  "companyCode": "string (unique, for companies)",
  "companyAccessCode": "string (for companies)",
  "ownerId": "<ObjectID (user who owns the company)>",
  "paymentMethods": ["string"],
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zip": "string"
  },
  "customers": ["<ObjectID (associated customer users)>"]
}
```

## 3. Simplified API Endpoints

The new `account-service` will expose a single `/accounts` resource.

*   **`POST /accounts`** (Register)
    *   Handles registration for all account types based on the `role` in the request body.
    *   If `role` is "company", it creates both a `USER` and a `COMPANY` account.

*   **`POST /accounts/login`**
    *   Authenticates a user and returns JWTs.

*   **`GET /accounts`** (Get multiple accounts)
    *   **Admin:** Returns all accounts.
    *   **Company:** `?role=customer` returns associated customer accounts.
    *   **Customer:** `?type=company` returns associated company accounts.

*   **`GET /accounts/{id}`**
    *   Returns the details of any account (user or company) by its ID.

*   **`PATCH /accounts/{id}`** (Update an account)
    *   The primary update endpoint for users and companies. The service logic will determine what can be updated based on the user's role and the fields provided.

*   **`DELETE /accounts/{id}`**
    *   Deletes an account. Permissions are handled by the service.

## 4. Migration Plan & Progress

This checklist will be updated as each step is completed.

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


# Your last response
Thank you, that's a critical clarification. It introduces a much more robust and secure workflow. I've revised my plan to
  incorporate these new requirements.

  Please review the following detailed plan and confirm if I've understood you correctly.

  Revised Plan

  1. New Database Collection: `codes`

  I will create a new MongoDB collection named codes. This collection will be central to the new registration flow and will store
  two types of codes:

   * `BUSINESS` codes: Created by an Admin, used once by a company to register.
   * `COMPANY` codes: Created by a Company user after they register, used by their customers to register.

  A document in this collection will have this structure:

   1 {
   2   "_id": "<ObjectID>",
   3   "code": "string",       // The unique code value (e.g., "BIZ-XYZ" or "COMP-ABC")
   4   "type": "string",       // "BUSINESS" or "COMPANY"
   5   "is_claimed": "boolean",   // For "BUSINESS" codes, is it used?
   6   "company_id": "<ObjectID>", // For "COMPANY" codes, which company does it belong to?
   7   "createdAt": "<ISODate>"
   8 }

  2. New `status` Field in `accounts` Collection

  I will add a status field to the Account model for company accounts. This will track whether a company has completed its setup.

   * `pending_setup`: The initial state after a company registers.
   * `active`: The state after a company has set its unique customer-facing code.

  3. New API Endpoints

  I will create two new endpoints to manage these codes:

   * `POST /codes` (Admin Only)
       * Purpose: Allows an admin to create new BUSINESS codes.
       * Request Body: { "code": "BIZ-XYZ", "type": "BUSINESS" }
       * Authorization: Restricted to admin users.

   * `POST /accounts/company-code` (Company Role Only)
       * Purpose: Allows a newly registered company user to set their unique, unchangeable code for their customers.
       * Request Body: { "code": "COMP-ABC" }
       * Authorization: Restricted to company users whose status is pending_setup.

  4. Updated Registration & Operational Flow

  The entire process will now work as follows:

   1. Admin Creates Business Code: An admin uses POST /codes to create one or more BUSINESS codes.

   2. Company Registration (`POST /accounts`):
       * A user registers with role: "company" and provides a valid, unclaimed businessCode.
       * The system validates the code in the codes collection.
       * If valid, a new company account and an associated user account are created with a status of pending_setup.
       * The businessCode is marked as is_claimed: true.

   3. Company Sets Its Code (`POST /accounts/company-code`):
       * The newly registered company user logs in.
       * They call the POST /accounts/company-code endpoint with their desired unique code (e.g., "COMP-ABC").
       * The system verifies this code is globally unique.
       * It then creates a new document in the codes collection with type: "COMPANY" and associates it with their company_id.
       * Finally, the company's account status is updated to active.

   4. Customer Registration (`POST /accounts`):
       * A new user registers with role: "customer" and provides the companyCode (e.g., "COMP-ABC").
       * The system finds the code in the codes collection.
       * It uses the company_id from the code document to associate the new customer with the correct company.

  This ensures no company can be created without a valid business code, and no customer can register without a valid code from an
  active company.

  Does this updated plan match your vision?

╭─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│  > do we need following becaouse it can achive by account update call. * `POST /accounts/company-code` (Company Role Only)  │
│           * Purpose: Allows a newly registered company user to set their unique, unchangeable code for their customers.     │
│           * Request Body: { "code": "COMP-ABC" }                                                                            │
│           * Authorization: Restricted to company users whose status is pending_setup.                                       │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

✦ That's an excellent point. You are correct, we could use the general PATCH /accounts/{id} endpoint to achieve this.

  However, I would recommend we keep the dedicated POST /accounts/company-code endpoint for a few important reasons:

   1. Clarity and Intent: A dedicated endpoint makes the API's purpose explicit. When another developer (or you, in the future) sees
      POST /accounts/company-code, they know exactly what it does: it's a special, one-time action to set the company's customer code.
      Overloading the PATCH endpoint makes the logic more hidden.

   2. Security and Immutability: This code is meant to be set once and never changed. A dedicated endpoint makes this rule much easier
      to enforce. The logic is simple: "If the company status is pending_setup, allow this action. Otherwise, reject it." If we used
      the PATCH endpoint, we would have to add complex checks to the update logic to prevent this specific field from ever being
      changed after it's been set.

   3. Simpler Logic: The UpdateAccount handler can remain simple and focused on general updates (like changing a phone number or
      address). The specialized, critical logic for creating the company code and activating the account is isolated in its own
      handler, making the code cleaner and easier to maintain.

  For these reasons, I strongly recommend we stick with the dedicated POST /accounts/company-code endpoint. It creates a more
  robust, secure, and easier-to-understand API.

  Does that reasoning make sense, or would you still prefer to merge this functionality into the update endpoint?

╭─────────────────╮
│  > ok keep it.  │
╰─────────────────╯

✦ Excellent. I will proceed with the plan as we've discussed.

  First, I will implement the database schema changes by modifying account-service/internal/storage/models.go. I'll add the new
  Code struct and the Status field to the Account struct.
 ╭────────────────────────────────────────────────────────╮
 │ ✔  ReadFile ...unt-service/internal/storage/models.go  │
 ╰────────────────────────────────────────────────────────╯
✦ Okay, I'm updating models.go with the new Code struct and Status field.

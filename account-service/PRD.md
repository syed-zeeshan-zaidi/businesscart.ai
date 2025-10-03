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
	Address      *Address      `bson:"address,omitempty"` // Account holder's primary address
}
```

-   **`CompanyData`**: Contains company-specific fields, including a `Status` field (e.g., `pending_setup`, `active`). It also holds the configurations for the checkout process, such as `paymentMethods`, `deliveryMethods`, and `shippingOutOptions`. This data is passed to the Checkout Service to provide a company-specific checkout experience for customers.
-   **`CustomerData`**: Contains customer-specific data, including a list of `CustomerCodes` they are associated with.
-   **`PartnerData`**: Contains partner-specific information.

### `codes` Collection

Stores registration codes created by an Admin.

```go
type Code struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CompanyCode  string             `bson:"companyCode" json:"companyCode"`
	CustomerCode string             `bson:"customerCode" json:"customerCode"`
	PartnerCode  string             `bson:"partnerCode,omitempty" json:"partnerCode,omitempty"`
	IsClaimed    bool               `bson:"is_claimed" json:"isClaimed"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
}
```

-   `CompanyCode`: Used once by a `company` to register.
-   `CustomerCode`: Used by `customer`s to associate with a company. Can be used multiple times.
-   `PartnerCode`: Used once by a `partner` to register.

### Location and Address Management

To support multiple pickup/shipout locations for companies and multiple shipping addresses for customers, the `account-service` will manage dedicated collections for `CompanyLocation` and `CustomerAddress` entities.

#### `company_locations` Collection

Stores detailed information for each company location.

```go
type CompanyLocation struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CompanyID      primitive.ObjectID `bson:"companyId" json:"companyId"` // Reference to the Company's Account ID
	LocationName   string             `bson:"locationName" json:"locationName"`
	Address        Address            `bson:"address" json:"address"` // Re-use existing Address struct
	ContactPerson  string             `bson:"contactPerson,omitempty" json:"contactPerson,omitempty"`
	PhoneNumber    string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	OperatingHours string             `bson:"operatingHours,omitempty" json:"operatingHours,omitempty"` // e.g., "Mon-Fri 9-5"
	Capacity       string             `bson:"capacity,omitempty" json:"capacity,omitempty"` // e.g., "5000 sq ft", "100 pallets"
	LocationType   string             `bson:"locationType" json:"locationType"` // e.g., "pickup", "warehouse", "storefront"
	IsDefault      bool               `bson:"isDefault" json:"isDefault"` // Flag for default location
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updatedAt" json:"updatedAt"`
}
```

#### `customer_addresses` Collection

Stores detailed information for each customer shipping address.

```go
type CustomerAddress struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CustomerID         primitive.ObjectID `bson:"customerId" json:"customerId"` // Reference to the Customer's Account ID
	RecipientName      string             `bson:"recipientName" json:"recipientName"`
	Address            Address            `bson:"address" json:"address"` // Re-use existing Address struct
	PhoneNumber        string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`	AddressLabel       string             `bson:"addressLabel,omitempty" json:"addressLabel,omitempty"` // e.g., "Home", "Work"
	IsDefaultShipping  bool               `bson:"isDefaultShipping" json:"isDefaultShipping"` // Flag for default shipping address
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt" json:"updatedAt"`
}
```

#### Updated Role Sub-Documents

The `CompanyData` and `CustomerData` structs will be updated to include references to these new collections and to embed full details of default/recent locations/addresses for optimized frontend access.

```go
type CompanyData struct {
	Name                  string              `bson:"name" json:"name"`
	Status                string              `bson:"status" json:"status"`
	UniqueIdentifier      string              `bson:"uniqueIdentifier" json:"uniqueIdentifier"`
	SaleRepresentative    string              `bson:"saleRepresentative" json:"saleRepresentative"`
	CreditLimit           float64             `bson:"creditLimit" json:"creditLimit"`
	LeadTime              float64             `bson:"leadTime" json:"leadTime"`
	MaxOrderAmountLimit   float64             `bson:"maxOrderAmountLimit" json:"maxOrderAmountLimit"`
	MaxOrderQuantityLimit float64             `bson:"maxOrderQuantityLimit" json:"maxOrderQuantityLimit"`
	MinOrderAmountLimit   float64             `bson:"minOrderAmountLimit" json:"minOrderAmountLimit"`
	MinOrderQuantityLimit float64             `bson:"minOrderQuantityLimit" json:"minOrderQuantityLimit"`
	MonthlyOrderLimit     float64             `bson:"monthlyOrderLimit" json:"monthlyOrderLimit"`
	YearlyOrderLimit      float64             `bson:"yearlyOrderLimit" json:"yearlyOrderLimit"`
	TaxableGoods          bool                `bson:"taxableGoods" json:"taxableGoods"`
	QuotesAllowed         bool                `bson:"quotesAllowed" json:"quotesAllowed"`
	CompanyCodeID         string              `bson:"companyCodeId,omitempty" json:"companyCodeId,omitempty"`
	CompanyCode           string              `bson:"companyCode" json:"companyCode"`
	ShippingOutOptions    []ShippingOutOption `bson:"shippingOutOptions" json:"shippingOutOptions"`
	PaymentMethods        []PaymentMethod     `bson:"paymentMethods" json:"paymentMethods"`
	DeliveryMethods       []DeliveryMethod    `bson:"deliveryMethods" json:"deliveryMethods"`
	SellingArea           struct {
		Radius float64 `bson:"radius" json:"radius"`
		Center Coords  `bson:"center" json:"center"`
	} `bson:"sellingArea" json:"sellingArea"`
	Address Address `bson:"address" json:"address"` // Company's primary address

	// New fields for multiple locations
	LocationIDs           []primitive.ObjectID `bson:"locationIds,omitempty" json:"locationIds,omitempty"` // References to CompanyLocation documents
	DefaultPickupLocation *CompanyLocation     `bson:"defaultPickupLocation,omitempty" json:"defaultPickupLocation,omitempty"` // Full struct for default pickup
	DefaultWarehouseLocation *CompanyLocation  `bson:"defaultWarehouseLocation,omitempty" json:"defaultWarehouseLocation,omitempty"` // Full struct for default warehouse
}

type CustomerData struct {
	CustomerCodes     []CustomerCodeEntry `bson:"customerCodes" json:"customerCodes"`
	AttachedCompanies []CompanyData       `bson:"attachedCompanies,omitempty" json:"attachedCompanies,omitempty"`

	// New fields for multiple addresses
	AddressIDs            []primitive.ObjectID `bson:"addressIds,omitempty" json:"addressIds,omitempty"` // References to CustomerAddress documents
	DefaultShippingAddress *CustomerAddress    `bson:"defaultShippingAddress,omitempty" json:"defaultShippingAddress,omitempty"` // Full struct for default shipping
	RecentShippingAddresses []*CustomerAddress `bson:"recentShippingAddresses,omitempty" json:"recentShippingAddresses,omitempty"` // Bounded list of full structs
}
```

## 3. Implemented API Endpoints

The service exposes the following endpoints:

*   **`POST /accounts/register`**: Creates a new account. The logic varies based on the `role` provided.
*   **`POST /accounts/login`**: Authenticates a user and returns an access token and a refresh token.
*   **`GET /accounts`**: Retrieves a list of accounts. Results are filtered based on the caller's role (e.g., an Admin sees all, a Company sees their associated customers).
*   **`GET /accounts/{id}`**: Retrieves the details of a specific account.
    *   **Updated Behavior:** For `company` and `customer` roles, this endpoint will now also perform internal lookups to fetch the full details of the `DefaultPickupLocation`, `DefaultWarehouseLocation` (for companies), `DefaultShippingAddress`, and `RecentShippingAddresses` (for customers) and embed them into the `CompanyData` and `CustomerData` sub-documents respectively. This provides immediate access to frequently used location data without additional frontend API calls.
*   **`PATCH /accounts/{id}`**: Updates the details of a specific account. This is a generic update endpoint.
*   **`DELETE /accounts/{id}`**: Deletes an account.
*   **`POST /codes`** (Admin Only): Creates a new registration code document containing a `CompanyCode` and `CustomerCode`.
*   **`GET /codes/{code}`** (Admin Only): Retrieves the details of a specific registration code.

### `PATCH /customers/{customerId}/associate`

This endpoint provides a flexible mechanism for associating an existing customer account with a company account after the initial registration. It supports two distinct operational modes based on the role of the authenticated user making the request.

#### Scenario 1: Customer-Initiated Association

A logged-in customer can use this endpoint to associate their own account with a new company by providing that company's specific `customerCode`.

*   **Role:** `customer`
*   **Authorization:** The customer must be authenticated, and the `{customerId}` in the URL must match the ID in their JWT.
*   **Request Body:**
    ```json
    {
      "customerCode": "CUST-BETA-202"
    }
    ```
*   **Logic:**
    1.  The service validates that the `customerCode` exists and is valid.
    2.  It retrieves the corresponding `companyId` from the `codes` collection.
    3.  It adds a new `CustomerCodeEntry` to the customer's `customerConfigs` array in their account document.

#### Scenario 2: Company-Initiated Association

A logged-in company can use this endpoint to claim an existing customer and associate them with their own company.

*   **Role:** `company`
*   **Authorization:** The company must be authenticated. The `{customerId}` in the URL refers to the target customer account.
*   **Request Body:** (Empty)
*   **Logic:**
    1.  The service identifies the calling company from its JWT.
    2.  It retrieves the company's own `customerCode` from its account data.
    3.  It adds a new `CustomerCodeEntry` (containing the company's `codeId` and `customerCode`) to the specified customer's `customerConfigs` array.

### Location and Address Management API Endpoints

New API endpoints will be added to manage `CompanyLocation` and `CustomerAddress` entities. These endpoints will interact with the new `company_locations` and `customer_addresses` collections.

*   **For `CompanyLocation` (accessible by `company` and `admin` roles):**
    *   `POST /companies/{companyId}/locations`: Create a new location for a company.
    *   `GET /companies/{companyId}/locations`: Get all locations for a company.
    *   `GET /companies/{companyId}/locations/{locationId}`: Get a specific location.
    *   `PUT /companies/{companyId}/locations/{locationId}`: Update a location.
    *   `DELETE /companies/{companyId}/locations/{locationId}`: Delete a location.
    *   **Authorization:** Implement middleware to ensure only the `companyId` owner or an `admin` can access/modify these.
*   **For `CustomerAddress` (accessible by `customer` and `admin` roles):**
    *   `POST /customers/{customerId}/addresses`: Create a new address for a customer.
    *   `GET /customers/{customerId}/addresses`: Get all addresses for a customer.
    *   `GET /customers/{customerId}/addresses/{addressId}`: Get a specific address.
    *   `PUT /customers/{customerId}/addresses/{addressId}`: Update an address.
    *   `DELETE /customers/{customerId}/addresses/{addressId}`: Delete an address.
    *   **Authorization:** Implement middleware to ensure only the `customerId` owner or an `admin` can access/modify these.

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

### Phase 4: Location and Address Management (New Phase)

- [x] **(Next)** Update `account-service/internal/storage/models.go` with `CompanyLocation`, `CustomerAddress` structs, and `LocationIDs`/`AddressIDs` in `CompanyData`/`CustomerData`. (Completed in previous step)
- [ ] Implement new MongoDB collections for `company_locations` and `customer_addresses`.
- [ ] Implement new API endpoints in `account-service` for managing and fetching `CompanyLocation`s and `CustomerAddress`es.
- [ ] Modify `GET /accounts/{id}` in `account-service` to perform internal lookups for default/recent `CompanyLocation` and `CustomerAddress` and embed their full details into the `Account` response.

### Phase 5: Testing & Cleanup (Updated)

- [ ] Run the `new_full_api_test.sh` script and verify all functionality.
- [ ] Remove the old `user-service` and `company-service` directories and their stacks.
- [ ] Update `bin/business-cart.ts` to use only the new `account-service-stack`.

## Refactoring: customerCodes to customerConfig

This section outlines the plan to rename the critical `customerCodes` field to the more descriptive `customerConfig` across the application.

### Part 1: `account-service` Backend Refactoring

**Affected Files:**
*   `internal/storage/models.go`
*   `internal/handler/http.go`
*   `internal/storage/mongodb.go`

**Task List:**

- [x] **Task 1.1:** Modify Data Model (`internal/storage/models.go`): In the `CustomerData` struct, rename the Go field `CustomerCodes` to `CustomerConfigs`.
- [x] **Task 1.2:** Modify Data Model (`internal/storage/models.go`): Update the BSON tag for the field from `customerCodes` to `customerConfigs`.
- [x] **Task 1.3:** Modify Data Model (`internal/storage/models.go`): Update the JSON tag for the field from `customerCodes` to `customerConfigs`.
- [x] **Task 2.1:** Modify HTTP Handler (`internal/handler/http.go`): In the `RegisterRequest` struct, rename the `CustomerCodes` field to `CustomerConfigs` and update its JSON tag.
- [x] **Task 2.2:** Modify HTTP Handler (`internal/handler/http.go`): In the `Register` handler, update logic that reads from `req.CustomerCodes` to use `req.CustomerConfigs`.
- [x] **Task 2.3:** Modify HTTP Handler (`internal/handler/http.go`): In the `Login` handler, update the loop that iterates over `user.CustomerData.CustomerCodes` to use `user.CustomerData.CustomerConfigs`.
- [x] **Task 2.4:** Modify HTTP Handler (`internal/handler/http.go`): In the `RefreshToken` handler, update the loop that iterates over `user.CustomerData.CustomerCodes` to use `user.CustomerData.CustomerConfigs`.
- [x] **Task 2.5:** Modify HTTP Handler (`internal/handler/http.go`): In the `generateAndStoreRefreshToken` function, update the loop that iterates over `user.CustomerData.CustomerCodes` to use `user.CustomerData.CustomerConfigs`.
- [x] **Task 2.6:** Modify HTTP Handler (`internal/handler/http.go`): In the `GetAccounts` handler, update the MongoDB query filter from `{"customer.customerCodes.codeId": userID}` to `{"customer.customerConfigs.codeId": userID}`.
- [x] **Task 3.1:** Modify Database Logic (`internal/storage/mongodb.go`): In the `UpdateCustomerConfiguration` function, update the MongoDB update path from `customer.customerCodes.$[elem].configuration` to `customer.customerConfigs.$[elem].configuration`.

### Part 2: Infrastructure (CDK) Review

**Affected Files:**
*   `lib/account-service-stack.ts`

**Task List:**

- [x] **Task 4.1:** Review `lib/account-service-stack.ts` for any hardcoded references to `customerCodes`. (No changes are expected).

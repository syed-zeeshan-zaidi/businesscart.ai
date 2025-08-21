# Migration Plan: Catalog Service from TypeScript to Go

## 1. Overview

This document outlines the plan to migrate the `catalog-service` from its current TypeScript implementation to Go. The primary goals are to standardize the backend stack on Go, improve performance, and align the service's structure with other Go-based services like `account-service`.

## 2. Pre-Migration Analysis

-   **Reference Service:** The `account-service` will be used as the blueprint for the new Go project structure, configuration, and CDK deployment patterns.
-   **Feature Set:** The existing functionality of the TypeScript `catalog-service` will be fully replicated. This includes all API endpoints (`POST`, `GET /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`), the data model, and the role-based authorization logic.

## 3. Migration Phases

The migration will be executed in the following phases to ensure a smooth transition.

### Phase 1: Project Scaffolding & Setup

1.  **Initialize Go Module:** In the `catalog-service` directory, run `go mod init business-cart/catalog-service` to create a new `go.mod` file.
2.  **Create Directory Structure:** Create a new directory structure that mirrors the `account-service`:
    ```
    catalog-service/
    ├── cmd/
    │   └── server/
    │       └── main.go
    └── internal/
        ├── config/
        │   └── config.go
        ├── handler/
        │   └── http.go
        ├── storage/
        │   ├── models.go
        │   └── mongodb.go
        └── middleware/
            └── auth.go
    ```
3.  **Add Dependencies:** Add necessary Go modules to `go.mod`, such as `go-chi` for routing, `mongodb-driver`, and `aws-lambda-go`.

### Phase 2: Application Logic Implementation

1.  **Configuration:** Implement `internal/config/config.go` to load environment variables (`MONGO_URI`, `JWT_SECRET`, etc.), similar to `account-service`.
2.  **Data Models:** Define the `Product` struct in `internal/storage/models.go`. This will be the Go equivalent of the Mongoose schema in `catalog-service/src/models/product.ts`.
3.  **Storage Layer:** Implement the database logic in `internal/storage/mongodb.go`. This will include functions for creating, finding, updating, and deleting products in MongoDB.
4.  **HTTP Handler:** Implement the API endpoint handlers in `internal/handler/http.go`. This will involve creating a `Handler` struct and methods for each route, translating the logic from `catalog-service/src/handler.ts`.
5.  **Routing & Main:** Set up the Chi router in `cmd/server/main.go`. This file will also contain the Lambda entry point and the adapter to convert API Gateway events to standard `http.Request` objects, just like in `account-service`.
6.  **Authorization Middleware:** Re-implement the authorization logic from `authorizer.ts` as a Go middleware in `internal/middleware/auth.go`. This middleware will validate the JWT and extract user information (`accountID`, `userRole`, `associateCompanyIds`) into the request context.

### Phase 3: CDK Stack Update

1.  **Locate the Stack File:** The relevant file is `lib/catalog-service-stack.ts`.
2.  **Update Lambda Runtime:** Change the `runtime` property for the `CatalogService` Lambda function from `lambda.Runtime.NODEJS_18_X` to `lambda.Runtime.GO_1_X`.
3.  **Update Code Asset & Bundling:** Modify the `code` property to point to the `catalog-service` directory and add the Go bundling configuration. This will involve a command to build the Go binary, similar to the `account-service-stack.ts`.
    ```typescript
    // Before
    code: lambda.Code.fromAsset('catalog-service/dist'),

    // After
    code: lambda.Code.fromAsset(path.join(__dirname, '..', 'catalog-service'), {
      bundling: {
        image: lambda.Runtime.GO_1_X.bundlingImage,
        command: [
          'bash',
          '-c',
          'go build -o /asset-output/bootstrap ./cmd/server/main.go',
        ],
        user: 'root',
      },
    }),
    ```
4.  **Update Handler:** Change the `handler` property to `"bootstrap"`.
5.  **Authorizer Migration:** The existing `CatalogAuthorizer` Lambda (Node.js) will be replaced with the new Go middleware inside the main service Lambda. The separate authorizer function will be removed from the CDK stack, and the API Gateway configuration will be updated to remove the custom authorizer integration. All authorization logic will be handled within the main Go application.

### Phase 4: Testing

1.  **Unit Tests:** Write unit tests for the handler and storage layers of the new Go service.
2.  **Integration Tests:** Update existing integration tests or create new ones to validate the behavior of the new Go-based API endpoints. The `test_full_api_flow.sh` and other relevant scripts should be updated if necessary.

### Phase 5: Cleanup

After the Go service is deployed and verified to be working correctly, the following TypeScript-related files and directories will be removed from the `catalog-service` directory:

-   `src/`
-   `tests/`
-   `node_modules/`
-   `dist/`
-   `package.json`
-   `package-lock.json`
-   `tsconfig.json`
-   `jest.config.js`

## 4. Rollback Plan

In case of critical issues with the new Go service, the migration can be rolled back by:

1.  Reverting the changes to `lib/catalog-service-stack.ts` to restore the Node.js Lambda configuration.
2.  Re-deploying the CDK stack.
3.  The old TypeScript code will be retained in version control until the migration is deemed stable and successful.
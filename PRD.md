# Product Requirements Document: BusinessCart

## 1. Introduction

This document outlines the product requirements for the BusinessCart application. BusinessCart is a B2B e-commerce platform designed to facilitate transactions between companies and their customers. The platform is built on a microservices architecture, with separate services for managing users, companies, products, and the checkout process.

## 2. System Architecture

The BusinessCart application is built on a **serverless, cloud-native architecture**. It leverages AWS services for hosting and managing the different microservices. The entire infrastructure is defined using **Infrastructure as Code (IaC)** with the **AWS Cloud Development Kit (CDK)**, and the application is written in **TypeScript and Go**.

### 2.1. Architectural Principles

*   **Microservices:** The application is divided into small, independent services that can be developed, deployed, and scaled independently.
*   **Serverless:** The services are deployed as AWS Lambda functions, which allows for automatic scaling and pay-per-use pricing.
*   **Cloud-Native:** The application is designed to take full advantage of the benefits of cloud computing.
*   **Infrastructure as Code (IaC):** The entire infrastructure is defined as code using the AWS CDK, which allows for automated, repeatable deployments.

### 2.2. Architecture Diagram

```
+----------------+      +-----------------+      +------------------+
|   Web Portal   |----->|                 |----->|  Account Service |
+----------------+      |                 |      +------------------+
                        |                 |
+----------------+      |   API Gateway   |      +------------------+
|  Mobile Apps   |----->|                 |----->|  Catalog Service |
| (Android/iOS)  |      |                 |      +------------------+
+----------------+      |                 |
                        |                 |      +------------------+
                        |                 |----->| Checkout Service |
                        +-----------------+      +------------------+
```

### 2.3. Microservices

*   **Account Service:** Manages user authentication, registration, roles, and company/customer associations.
*   **Catalog Service:** Manages product information.
*   **Checkout Service:** Orchestrates the entire checkout process, including cart management, quoting, and order creation.
*   **Web Portal:** The frontend application for users to interact with the platform.
*   **Mobile Apps:** Native Android and iOS applications for customers.

## 3. Data Flow Example: Customer Places an Order

1.  A customer adds products to their cart from the **Web Portal** or **Mobile App**.
2.  The client sends a request to the **Checkout Service** to manage the cart.
3.  The customer proceeds to checkout.
4.  The client sends a request to the **Checkout Service** to create a quote.
5.  The **Checkout Service** calculates taxes, shipping, and promotions and creates a quote.
6.  The client displays the quote to the customer.
7.  The customer confirms the order.
8.  The client sends a request to the **Checkout Service** to place the order, including the `quoteId` and a `paymentToken`.
9.  The **Checkout Service** processes the payment and creates a permanent order.
10. The **Checkout Service** sends a confirmation to the customer.

## 4. CI/CD Pipeline

The project is configured with a CI/CD pipeline using GitHub Actions to ensure code quality and prepare for deployment.

### 4.1. Continuous Integration (Pull Requests)

*   **Workflows**:
    *   `.github/workflows/code-quality.yml`
    *   `.github/workflows/pr-pipeline.yml`
*   **Trigger**: On every `pull_request` to the `main` branch.
*   **Actions**:
    1.  **Lint Code**: Runs ESLint on the `web-portal` to enforce code style.
    2.  **Build & Test**: Builds the CDK, the web portal, and all Go services. Runs unit tests for the Go services.
    3.  **CDK Synth**: Synthesizes the CloudFormation template to ensure it's valid.

### 4.2. Build & Lint (`main` branch)

*   **Workflow**: `.github/workflows/production-pipeline.yml`
*   **Trigger**: On every `push` to the `main` branch.
*   **Actions**:
    1.  **Install Dependencies**: Installs all Node.js and Go dependencies.
    2.  **Build All Services**: Compiles the root CDK project, the `web-portal`, and all Go services.
    3.  **Lint All Services**: Runs linters on the root project, the `web-portal` (`npm run lint`), and all Go services (`go fmt` and `go vet`).
*   **Purpose**: This workflow ensures that the code on the `main` branch is always in a clean, buildable, and lint-free state, ready for deployment.

### 4.3. Production Deployment

*   **Deployment is currently a manual process.**
*   **Steps**:
    1.  Ensure your local AWS credentials are configured for the production account.
    2.  Run the `cdk deploy` command with the `prod` stage context:
        ```bash
        npx cdk deploy --all --context stage=prod
        ```
*   **Future Improvement**: The deployment step can be added to the `production-pipeline.yml` workflow to create a fully automated CD pipeline.

## 5. Production Readiness & Configuration

The application is architected for multi-stage deployments, ensuring a clear separation between local development and production environments.

### 5.1. Multi-Stage Deployments

The CDK stack is parameterized by a `stage` context variable (`-c stage=...`). This allows for deploying multiple, isolated instances of the application (e.g., `local`, `staging`, `prod`) from the same codebase. Resource names are dynamically generated based on the stage to prevent collisions.

### 5.2. Secret and Configuration Management

*   **Production (`prod` stage)**: All secrets and environment-specific configurations (e.g., database URIs, API keys, CORS origins) are securely stored in **AWS Systems Manager (SSM) Parameter Store**. The CDK stack fetches these values at deployment time and injects them into the Lambda functions' environment variables.
*   **Local Development (`local` stage)**: For local development, a `local.env.json` file is used to store environment variables. This file is ignored by Git and allows developers to use local or development-specific resources without affecting the production environment. The `manage_services.sh` script uses this file to configure the local SAM environment.

### 5.3. Dynamic CORS Policy

The API Gateway's CORS policy is configured dynamically based on the deployment stage:
*   **`local` stage**: Allows all origins (`*`) for ease of development.
*   **`prod` stage**: Restricts allowed origins to a specific list of domains fetched from an SSM parameter (`/BusinessCart/prod/CORS_ALLOWED_ORIGINS`). This is a critical security measure to protect the production API.

## 6. Local Development

### 6.1. `manage_services.sh`

This script is the entry point for running the application locally.
*   `start`: Clears the `cdk.out` cache, synthesizes the CDK template for the `local` stage, and starts all microservices using `sam local start-api`.
*   `stop`: Stops all running services.
*   `restart`: A convenient shortcut for `stop` followed by `start`.

### 6.2. Test Scripts

A suite of bash scripts is available for end-to-end testing of the running application:
*   `test_full_api.sh`
*   `test_specific_company_api_flow.sh`

## 7. Future Improvements

*   **CI/CD**: Add a `staging` environment to the CD pipeline to test changes before deploying to production. Automate the production deployment step in the `production-pipeline.yml` workflow.
*   **Monitoring**: Implement comprehensive monitoring and alarming for all production Lambda functions and the API Gateway (e.g., error rates, latency, invocation metrics).
*   **Testing**: Increase unit and integration test coverage across all services.
## 8. Production Pipeline Workflow

The production pipeline is defined in `.github/workflows/production-pipeline.yml` and is crucial for maintaining the integrity of the `main` branch.

*   **Trigger**: This workflow is automatically triggered on every `push` to the `main` branch.
*   **Purpose**: It acts as a quality gate to ensure that the codebase on the `main` branch is always in a buildable, well-formatted, and lint-free state, making it ready for deployment at any time.

### 8.1. Pipeline Steps

1.  **Environment Setup**: The workflow begins by setting up a clean `ubuntu-latest` environment.
2.  **Checkout Code**: It checks out the latest version of the code from the `main` branch.
3.  **Setup Node.js and Go**: It installs and configures the required versions of Node.js (v18) and Go (v1.23), enabling caching for faster dependency resolution in subsequent runs.
4.  **Install Dependencies**: It runs `npm install` at the root and in the `web-portal` directory to fetch all necessary Node.js packages.
5.  **Build**: It compiles the root project and the `web-portal` using `npm run build`.
6.  **Lint**: It runs linters on the `web-portal` (`npm run lint`) to enforce code quality standards.
7.  **Build and Lint Go Services**: The workflow iterates through each Go microservice (`account-service`, `catalog-service`, `checkout-service`) to:
    *   Tidy dependencies (`go mod tidy`).
    *   Build the service into an executable (`go build`).
    *   Format the code (`go fmt ./...`).
    *   Vet the code for potential issues (`go vet ./...`).
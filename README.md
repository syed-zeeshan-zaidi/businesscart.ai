# BusinessCart

BusinessCart is a serverless e-commerce platform built with AWS CDK, enabling companies to manage products and customers. It uses API Gateway, Lambda, and MongoDB Atlas for data storage, with a custom authorizer for secure access.

## Features
- **User Management**: Register, login, refresh tokens, and logout.
- **Company Management**: Create, retrieve, update, and delete company profiles.
- **Product Management**: Add, retrieve, update, and delete products for companies.
- **Checkout Flow**: A two-step process to first create a quote and then place an order.
- **Secure Authorization**: Custom Lambda authorizer with JWT-based authentication.

## Prerequisites
- **Node.js**: v18.x or later
- **Go**: v1.20.x or later
- **AWS CLI**: v2.x, configured with credentials
- **AWS SAM CLI**: v1.123.0 or later
- **Docker**: v28.1.1 or later, running
- **MongoDB Atlas**: Connection string for database
- **Ubuntu**: 24.04.2 LTS (or compatible OS)

## Setup
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd BusinessCart
   ```

2. **Install Dependencies**:
   Install dependencies for all services:
   ```bash
   npm install
   cd company-service && npm install && cd ..
   cd product-service && npm install && cd ..
   cd user-service && npm install && cd ..
   cd payment-service && npm install && cd ..
   cd web-portal && npm install && cd ..
   ```

3. **Configure Environment Variables**:
   Create `.env` files in each service directory (`checkout-service`, `company-service`, `product-service`, `user-service`, `payment-service`) with:
   ```plaintext
   MONGO_URI=<your-mongodb-atlas-uri>
   JWT_SECRET=<your-jwt-secret>
   NODE_ENV=development
   ```

4. **Build Services**:
   Build all TypeScript services:
   ```bash
   npm run build
   ```
   Build the Go-based checkout-service:
    ```bash
    ./manage_services.sh build checkout-service
    ```

## API Testing Instructions
BusinessCart uses AWS SAM CLI for local API testing.

### Start Local API
Run each of the following commands in a separate terminal tab to start the services:

```bash
sam local start-api -t cdk.out/UserServiceStack.template.json --docker-network host --debug --port 3000
sam local start-api -t cdk.out/CompanyServiceStack.template.json --docker-network host --debug --port 3001
sam local start-api -t cdk.out/ProductServiceStack.template.json --docker-network host --debug --port 3002
sam local start-api -t cdk.out/CheckoutServiceStack.template.json --docker-network host --debug --port 3003
```

### Test Endpoints
Use a tool like `curl` or Postman to test the API endpoints.

#### User Login
```bash
curl -X POST http://127.0.0.1:3000/users/login \
-H "Content-Type: application/json" \
-d '{"username":"testuser","password":"test123"}'
```

#### Create a Quote
```bash
curl -X POST http://127.0.0.1:3003/checkout \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <accessToken>" \
-d '{
    "items": [
        {
            "productId": "product_id_1",
            "quantity": 1,
            "companyId": "company_id_1"
        }
    ]
}'
```

#### Place an Order
```bash
curl -X POST http://127.0.0.1:3003/checkout \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <accessToken>" \
-d '{
    "quoteId": "your_quote_id"
}'
```

## Project Structure
- **bin/**: CDK application entry point.
- **lib/**: CDK stack definitions.
- **checkout-service/**: Handles the checkout process (Go).
- **company-service/**: Company management service (TypeScript).
- **product-service/**: Product management service (TypeScript).
- **user-service/**: User management service (TypeScript).
- **payment-service/**: Payment processing service (TypeScript).
- **web-portal/**: Frontend application (React).



## Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -am 'Add feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Create a pull request.

## License
MIT License

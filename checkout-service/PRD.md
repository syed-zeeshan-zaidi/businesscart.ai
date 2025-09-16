# Checkout Service PRD

## 1. Overview

The Checkout Service handles the entire checkout process, from quote creation to order placement. It is responsible for calculating prices, managing quotes, and processing orders.

## 2. Features

### Quote Management

- **Create or Update (Upsert) Quotes**: When a customer proceeds to checkout, the service creates a new quote or updates an existing one for that specific customer and seller. This ensures a single, persistent quote per customer/seller pair until an order is placed.
- **Configuration Snapshot**: Quotes store a snapshot of the company's checkout configurations at the time of creation, including available payment methods, delivery methods, and shipping options. This ensures that the options presented to the user are consistent throughout their checkout session.
- **Expiration**: Quotes automatically expire after 24 hours.

### Order Placement

- **Create Orders from Quotes**: An order is created using a valid `quoteId`.
- **Payment Processing**: The service integrates with a mock Payment Service to process payments. It supports various online methods and offline methods like "pickup_pay".
- **Quote Deletion**: Upon successful order placement, the corresponding quote is deleted.

## 3. API Endpoints

*   **`POST /quotes`**: Creates a new quote or updates an existing one. 
    *   **Request Body**: `{ sellerId: string, paymentMethods: string[], deliveryMethods: string[], shippingOutOptions: string[] }`
    *   **Response Body**: The full `Quote` object.
*   **`GET /quotes/{quoteId}`**: Retrieves the details of a specific quote.
*   **`POST /orders`**: Creates a new order from a quote.
    *   **Request Body**: `{ quoteId: string, paymentMethod: string, paymentToken: string }`
    *   **Response Body**: The full `Order` object.

## 4. Data Models

### `Quote`

```go
type Quote struct {
	ID                          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CartID                      primitive.ObjectID `bson:"cartId" json:"cartId"`
	AccountID                   string             `bson:"accountId" json:"accountId"`
	SellerID                    string             `bson:"sellerId" json:"sellerId"`
	Items                       []cart.CartItem    `bson:"items" json:"items"`
	Subtotal                    float64            `bson:"subtotal" json:"subtotal"`
	ShippingCost                float64            `bson:"shippingCost" json:"shippingCost"`
	TaxAmount                   float64            `bson:"taxAmount" json:"taxAmount"`
	GrandTotal                  float64            `bson:"grandTotal" json:"grandTotal"`
	AvailablePaymentMethods     []string           `bson:"availablePaymentMethods" json:"availablePaymentMethods"`
	AvailableDeliveryMethods    []string           `bson:"availableDeliveryMethods" json:"availableDeliveryMethods"`
	AvailableShippingOutOptions []string           `bson:"availableShippingOutOptions" json:"availableShippingOutOptions"`
	CreatedAt                   time.Time          `bson:"createdAt" json:"createdAt"`
	ExpiresAt                   time.Time          `bson:"expiresAt" json:"expiresAt"`
}
```

## 5. Refactoring: Use Customer-Specific Configurations

This section outlines the plan to use the customer-specific configurations passed in the JWT.

### Task List:

- [x] **Task 1:** In `internal/handler/http.go`, update the `LambdaHandler` to extract the `configurations` claim from the JWT.
- [x] **Task 2:** In `internal/handler/http.go`, within the `handleCreateQuoteRequest` function, check for a customer-specific configuration for the given `sellerId`.
- [x] **Task 3:** If a customer-specific configuration exists, use it to override the default company configurations (payment methods, delivery methods, shipping options) when creating a quote.
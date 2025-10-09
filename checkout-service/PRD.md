# Checkout Service PRD

## 1. Overview

The Checkout Service handles the entire checkout process, from cart management to quote creation and order placement. It is responsible for calculating prices, managing carts, quotes, and processing orders.

## 2. Features

### Cart Management

- **Add to Cart**: Allows customers to add products to their shopping cart for a specific seller.
- **View Cart**: Allows customers to view the contents of their shopping cart for a specific seller.
- **Update Cart**: Allows customers to update the quantity of items in their shopping cart.
- **Remove from Cart**: Allows customers to remove items from their shopping cart.
- **Clear Cart**: Allows customers to clear all items from their shopping cart for a specific seller.

### Quote Management

- **Create or Update (Upsert) Quotes**: When a customer proceeds to checkout, the service creates a new quote or updates an existing one for that specific customer and seller. This ensures a single, persistent quote per customer/seller pair until an order is placed.
- **Configuration Snapshot**: Quotes store a snapshot of the company's checkout configurations at the time of creation, including available payment methods, delivery methods, and shipping options. This ensures that the options presented to the user are consistent throughout their checkout session.
- **Expiration**: Quotes automatically expire after 24 hours.

### Order Placement

- **Create Orders from Quotes**: An order is created using a valid `quoteId`.
- **Payment Processing**: The service integrates with a mock Payment Service to process payments. It supports various online methods and offline methods like "pickup_pay". The service expects a `paymentToken` for online payments.
- **Quote Deletion**: Upon successful order placement, the corresponding quote is deleted.

### Pricing

- **Discounted Pricing**: The service correctly handles discounted prices. If a `discountedPrice` is available for a product, it is used for all calculations.
- **Line Item and Cart Totals**: The service calculates the total for each line item (`lineItemTotal`) and the total for the entire cart (`totalPrice`), and these values are carried through to quotes and orders.

## 3. API Endpoints

### Cart Endpoints

*   **`POST /checkout/cart`**: Adds an item to the cart.
    *   **Request Body**: `{ "entity": CartItem }`
    *   **Response Body**: The updated `Cart` object.
*   **`GET /checkout/cart?sellerId={sellerId}`**: Retrieves the cart for a specific seller.
    *   **Response Body**: The `Cart` object.
*   **`PUT /checkout/cart/{itemId}?sellerId={sellerId}`**: Updates the quantity of an item in the cart.
    *   **Request Body**: `{ "entity": { "quantity": number } }`
    *   **Response Body**: The updated `Cart` object.
*   **`DELETE /checkout/cart/{itemId}?sellerId={sellerId}`**: Removes an item from the cart.
    *   **Response Body**: The updated `Cart` object.
*   **`DELETE /checkout/cart?sellerId={sellerId}`**: Clears the entire cart for a seller.
    *   **Response Body**: An empty `Cart` object.

### Quote Endpoints

*   **`POST /checkout/quotes`**: Creates a new quote or updates an existing one.
    *   **Request Body**: `{ "sellerId": string, "paymentMethods": string[], "deliveryMethods": string[], "shippingOutOptions": string[], "companyLocations": CompanyLocation[], "customerAddresses": CustomerAddress[] }`
    *   **Response Body**: The full `Quote` object.
*   **`GET /checkout/quotes/{quoteId}`**: Retrieves the details of a specific quote.

### Order Endpoints

*   **`POST /checkout/orders`**: Creates a new order from a quote.
    *   **Request Body**: `{ "quoteId": string, "paymentMethod": string, "paymentToken": string, "deliveryMethod": string, "pickupLocationId"?: string, "deliveryAddressId"?: string }`
    *   **Response Body**: The full `Order` object.
*   **`GET /checkout/orders`**: Retrieves orders for the current user. If the user has a "company" role, it retrieves orders for their company.

## 4. Data Models

### `Cart`

```go
type Cart struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	AccountID string             `bson:"accountId" json:"accountId"`
	SellerID  string             `bson:"sellerId" json:"sellerId"`
	Items     []CartItem         `bson:"items" json:"items"`
	TotalPrice float64            `bson:"totalPrice" json:"totalPrice"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}
```

### `CartItem`

```go
type CartItem struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ProductID       string             `bson:"productId" json:"productId"`
	Quantity        int                `bson:"quantity" json:"quantity"`
	SellerID        string             `bson:"sellerId" json:"sellerId"`
	Name            string             `bson:"name" json:"name"`
	Price           float64            `bson:"price" json:"price"`
	DiscountedPrice float64            `bson:"discountedPrice" json:"discountedPrice"`
	LineItemTotal   float64            `bson:"lineItemTotal" json:"lineItemTotal"`
}
```

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
	CompanyLocations            []CompanyLocation  `bson:"companyLocations,omitempty" json:"companyLocations,omitempty"`
	CustomerAddresses           []CustomerAddress  `bson:"customerAddresses,omitempty" json:"customerAddresses,omitempty"`
	CreatedAt                   time.Time          `bson:"createdAt" json:"createdAt"`
	ExpiresAt                   time.Time          `bson:"expiresAt" json:"expiresAt"`
}
```

### `Order`

```go
type Order struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	QuoteID           primitive.ObjectID `bson:"quoteId" json:"quoteId"`
	AccountID         string             `bson:"accountId" json:"accountId"`
	SellerID          string             `bson:"sellerId" json:"sellerId"`
	Items             []cart.CartItem    `bson:"items" json:"items"`
	Subtotal          float64            `bson:"subtotal" json:"subtotal"`
	ShippingCost      float64            `bson:"shippingCost" json:"shippingCost"`
	TaxAmount         float64            `bson:"taxAmount" json:"taxAmount"`
	GrandTotal        float64            `bson:"grandTotal" json:"grandTotal"`
	PaymentMethod     string             `bson:"paymentMethod" json:"paymentMethod"`
	DeliveryMethod    string             `bson:"deliveryMethod" json:"deliveryMethod"`
	TransactionID     string             `bson:"transactionId" json:"transactionId"`
	PickupLocationID  string             `bson:"pickupLocationId,omitempty" json:"pickupLocationId,omitempty"`
	DeliveryAddressID string             `bson:"deliveryAddressId,omitempty" json:"deliveryAddressId,omitempty"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	Status            string             `bson:"status" json:"status"`
}
```

## 5. Customer-Specific Configurations

This section outlines how customer-specific configurations, passed in the JWT, are used.

- **Discount Percentage**: A customer-specific discount percentage can be applied to the entire order.
- **Payment Methods**: A list of allowed payment methods for the customer.
- **Delivery Methods**: A list of allowed delivery methods for the customer.
- **Shipping Options**: A list of allowed shipping options for the customer.

### Task List:

- [x] **Task 1:** In `internal/handler/http.go`, update the `LambdaHandler` to extract the `configurations` claim from the JWT.
- [x] **Task 2:** In `internal/handler/http.go`, within the `handleCreateQuoteRequest` function, check for a customer-specific configuration for the given `sellerId`.
- [x] **Task 3:** If a customer-specific configuration exists, use it to override the default company configurations (payment methods, delivery methods, shipping options, and apply discounts) when creating a quote.
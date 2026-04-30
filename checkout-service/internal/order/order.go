package order

import (
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

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
	CustomerEmail     string             `bson:"customerEmail,omitempty" json:"customerEmail,omitempty"`
	TrackingNumber    string             `bson:"trackingNumber,omitempty" json:"trackingNumber,omitempty"`
	TrackingCarrier   string             `bson:"trackingCarrier,omitempty" json:"trackingCarrier,omitempty"`
	TrackingURL       string             `bson:"trackingUrl,omitempty" json:"trackingUrl,omitempty"`
	ShippedAt         *time.Time         `bson:"shippedAt,omitempty" json:"shippedAt,omitempty"`
	DeliveredAt       *time.Time         `bson:"deliveredAt,omitempty" json:"deliveredAt,omitempty"`
	UpdatedAt         *time.Time         `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

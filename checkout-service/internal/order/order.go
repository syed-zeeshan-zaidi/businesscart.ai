package order

import (
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Order struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	QuoteID      primitive.ObjectID `bson:"quoteId" json:"quoteId"`
	UserID       string             `bson:"userId" json:"userId"`
	CompanyID    string             `bson:"companyId" json:"companyId"`
	Items        []cart.CartItem    `bson:"items" json:"items"`
	Subtotal     float64            `bson:"subtotal" json:"subtotal"`
	ShippingCost float64            `bson:"shippingCost" json:"shippingCost"`
	TaxAmount    float64            `bson:"taxAmount" json:"taxAmount"`
	GrandTotal   float64            `bson:"grandTotal" json:"grandTotal"`
	Payment      struct {
		TransactionID string `bson:"transactionId" json:"transactionId"`
	} `bson:"payment" json:"payment"`
	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
}

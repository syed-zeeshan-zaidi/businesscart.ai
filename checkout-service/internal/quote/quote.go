package quote

import (
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Quote struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CartID       primitive.ObjectID `bson:"cartId" json:"cartId"`
	UserID       string             `bson:"userId" json:"userId"`
	CompanyID    string             `bson:"companyId" json:"companyId"`
	Items        []cart.CartItem    `bson:"items" json:"items"`
	Subtotal     float64            `bson:"subtotal" json:"subtotal"`
	ShippingCost float64            `bson:"shippingCost" json:"shippingCost"`
	TaxAmount    float64            `bson:"taxAmount" json:"taxAmount"`
	GrandTotal   float64            `bson:"grandTotal" json:"grandTotal"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	ExpiresAt    time.Time          `bson:"expiresAt" json:"expiresAt"`
}

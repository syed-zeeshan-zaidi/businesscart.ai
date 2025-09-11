package quote

import (
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Coords represents geographic coordinates.
type Coords struct {
	Lat float64 `bson:"lat" json:"lat"`
	Lng float64 `bson:"lng" json:"lng"`
}

// Address represents a physical address.
type Address struct {
	Street string `bson:"street" json:"street"`
	City   string `bson:"city" json:"city"`
	State  string `bson:"state" json:"state"`
	Zip    string `bson:"zip" json:"zip"`
	Coords Coords `bson:"coordinates" json:"coordinates"`
}

// CompanyLocation represents a company's physical location.
type CompanyLocation struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CompanyID    primitive.ObjectID `bson:"companyId" json:"companyId"`
	LocationName string             `bson:"locationName" json:"locationName"`
	Address      Address            `bson:"address" json:"address"`
}

// CustomerAddress represents a customer's address.
type CustomerAddress struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CustomerID        primitive.ObjectID `bson:"customerId" json:"customerId"`
	RecipientName     string             `bson:"recipientName" json:"recipientName"`
	Address           Address            `bson:"address" json:"address"`
	PhoneNumber       *string            `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	AddressLabel      *string            `bson:"addressLabel,omitempty" json:"addressLabel,omitempty"`
	IsDefaultShipping bool               `bson:"isDefaultShipping" json:"isDefaultShipping"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// Quote represents a price quote for a cart.
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

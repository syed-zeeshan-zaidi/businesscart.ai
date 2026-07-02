package cart

import "go.mongodb.org/mongo-driver/bson/primitive"

// CartItem represents an item in a shopping cart.
type CartItem struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ProductID       string             `bson:"productId" json:"productId"`
	Quantity        int                `bson:"quantity" json:"quantity"`
	SellerID        string             `bson:"sellerId" json:"sellerId"`
	PartnerID       string             `bson:"partnerId,omitempty" json:"partnerId,omitempty"`
	Name            string             `bson:"name" json:"name"`
	Price           float64            `bson:"price" json:"price"`
	ProposedPrice   float64            `bson:"proposedPrice,omitempty" json:"proposedPrice,omitempty"`
	DiscountedPrice float64            `bson:"discountedPrice" json:"discountedPrice"`
	LineItemTotal   float64            `bson:"lineItemTotal" json:"lineItemTotal"`
	Image           string             `bson:"image,omitempty" json:"image,omitempty"`
}

// Cart represents a shopping cart.
type Cart struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	AccountID  string             `bson:"accountId" json:"accountId"`
	SellerID   string             `bson:"sellerId" json:"sellerId"`
	Items      []CartItem         `bson:"items" json:"items"`
	TotalPrice float64            `bson:"totalPrice" json:"totalPrice"`
}

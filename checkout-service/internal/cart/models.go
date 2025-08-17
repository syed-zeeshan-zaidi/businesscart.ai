package cart

import "go.mongodb.org/mongo-driver/bson/primitive"

// CartItem represents an item in a shopping cart.
type CartItem struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ProductID string             `bson:"productId" json:"productId"`
	Quantity  int                `bson:"quantity" json:"quantity"`
	CompanyID string             `bson:"companyId" json:"companyId"`
	Name      string             `bson:"name" json:"name"`
	Price     float64            `bson:"price" json:"price"`
}

// Cart represents a shopping cart.
type Cart struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID     string             `bson:"userId" json:"userId"`
	CompanyID  string             `bson:"companyId" json:"companyId"`
	Items      []CartItem         `bson:"items" json:"items"`
	TotalPrice float64            `bson:"totalPrice" json:"totalPrice"`
}

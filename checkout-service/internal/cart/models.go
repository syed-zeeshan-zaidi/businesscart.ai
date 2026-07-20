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

// SavedList is a named snapshot of cart items ("Requisition List / Saved Cart").
// Stored as a sub-object on the cart so it round-trips through GetCart/SaveCart and
// survives ClearCart (which only touches items). Max 3 per cart, enforced in the service.
type SavedList struct {
	Name  string     `bson:"name" json:"name"`
	Items []CartItem `bson:"items" json:"items"`
}

// Cart represents a shopping cart.
type Cart struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	AccountID  string             `bson:"accountId" json:"accountId"`
	SellerID   string             `bson:"sellerId" json:"sellerId"`
	Items      []CartItem         `bson:"items" json:"items"`
	TotalPrice float64            `bson:"totalPrice" json:"totalPrice"`
	SavedLists []SavedList        `bson:"savedLists,omitempty" json:"savedLists,omitempty"`
}

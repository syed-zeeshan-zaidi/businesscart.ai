package storage

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Attribute struct {
	Key   string `bson:"key" json:"key"`
	Value string `bson:"value" json:"value"`
	Type  string `bson:"type,omitempty" json:"type,omitempty"`
}

type Product struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Name            string             `bson:"name" json:"name"`
	Description     string             `bson:"description,omitempty" json:"description,omitempty"`
	Price           float64            `bson:"price" json:"price"`
	DiscountedPrice float64            `bson:"-" json:"discountedPrice,omitempty"`
	SellerID        string             `bson:"sellerID" json:"sellerID"`
	Image           string             `bson:"image,omitempty" json:"image,omitempty"`
	Category        string             `bson:"category,omitempty" json:"category,omitempty"`
	Attributes      []Attribute        `bson:"attributes,omitempty" json:"attributes,omitempty"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
}

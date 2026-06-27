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

type PriceTier struct {
	MinQty int     `bson:"minQty" json:"minQty"`
	Price  float64 `bson:"price" json:"price"`
}

// Review is a single customer review. Admin-added only (no public submission).
type Review struct {
	Name      string    `bson:"name" json:"name"`
	Email     string    `bson:"email,omitempty" json:"email,omitempty"`
	Rating    int       `bson:"rating" json:"rating" validate:"gte=1,lte=5"`
	Title     string    `bson:"title,omitempty" json:"title,omitempty"`
	Body      string    `bson:"body" json:"body"`
	Verified  bool      `bson:"verified,omitempty" json:"verified,omitempty"`
	OrderID   string    `bson:"orderId,omitempty" json:"orderId,omitempty"`
	Date      time.Time `bson:"date" json:"date"`
	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
}

// RatingDistribution is the per-star count. Backend-computed from Reviews on every update.
type RatingDistribution struct {
	Star1 int `bson:"star1,omitempty" json:"star1,omitempty"`
	Star2 int `bson:"star2,omitempty" json:"star2,omitempty"`
	Star3 int `bson:"star3,omitempty" json:"star3,omitempty"`
	Star4 int `bson:"star4,omitempty" json:"star4,omitempty"`
	Star5 int `bson:"star5,omitempty" json:"star5,omitempty"`
}

// Rating is the aggregate + per-review embedded structure on Product.
// Count, Average, Distribution are backend-computed on every update; never trust client values.
type Rating struct {
	Count        int                 `bson:"count,omitempty" json:"count,omitempty"`
	Average      float64             `bson:"average,omitempty" json:"average,omitempty"`
	Distribution *RatingDistribution `bson:"distribution,omitempty" json:"distribution,omitempty"`
	Reviews      []Review            `bson:"reviews,omitempty" json:"reviews,omitempty"`
}

// BlogPost is an editorial article published on a company's D2C storefront.
// Positioned as informational content (not commercial) — no FAQ schema, no
// ItemList/Product schema. Article + Author + Publisher + BreadcrumbList only.
// Body is markdown source; HTML is rendered at storefront generation time.
type BlogPost struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	SellerID            string             `bson:"sellerID" json:"sellerID"`
	Title               string             `bson:"title" json:"title" validate:"required,min=10,max=200"`
	Slug                string             `bson:"slug" json:"slug" validate:"required,min=3,max=120"`
	Excerpt             string             `bson:"excerpt,omitempty" json:"excerpt,omitempty" validate:"max=300"`
	Body                string             `bson:"body" json:"body" validate:"required,min=200,max=100000"`
	FeaturedImage       string             `bson:"featuredImage,omitempty" json:"featuredImage,omitempty"`
	Author              string             `bson:"author" json:"author" validate:"required,min=2,max=100"`
	AuthorBio           string             `bson:"authorBio,omitempty" json:"authorBio,omitempty" validate:"max=500"`
	Category            string             `bson:"category" json:"category" validate:"required,min=2,max=80"`
	Tags                []string           `bson:"tags,omitempty" json:"tags,omitempty"`
	MentionedProductIDs []string           `bson:"mentionedProductIDs,omitempty" json:"mentionedProductIDs,omitempty"`
	MetaTitle           string             `bson:"metaTitle,omitempty" json:"metaTitle,omitempty" validate:"max=70"`
	MetaDescription     string             `bson:"metaDescription,omitempty" json:"metaDescription,omitempty" validate:"max=160"`
	Active              *bool              `bson:"active,omitempty" json:"active,omitempty"`
	PublishedAt         time.Time          `bson:"publishedAt" json:"publishedAt"`
	CreatedAt           time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt           time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type Product struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Name            string             `bson:"name" json:"name"`
	Description     string             `bson:"description,omitempty" json:"description,omitempty"`
	Price           float64            `bson:"price" json:"price"`
	DealPrice       float64            `bson:"dealPrice,omitempty" json:"dealPrice,omitempty" validate:"gte=0,lte=50"`
	DealStartDate   *time.Time         `bson:"dealStartDate,omitempty" json:"dealStartDate,omitempty"`
	DealEndDate     *time.Time         `bson:"dealEndDate,omitempty" json:"dealEndDate,omitempty"`
	DiscountedPrice float64            `bson:"-" json:"discountedPrice,omitempty"`
	SellerID        string             `bson:"sellerID" json:"sellerID"`
	PartnerID       string             `bson:"partnerId,omitempty" json:"partnerId,omitempty"`
	Images          []string           `bson:"images,omitempty" json:"images,omitempty"`
	Category        string             `bson:"category,omitempty" json:"category,omitempty"`
	GoogleProductCategory string       `bson:"googleProductCategory,omitempty" json:"googleProductCategory,omitempty"`
	Slug            string             `bson:"slug,omitempty" json:"slug,omitempty"`
	SKU             string             `bson:"sku,omitempty" json:"sku,omitempty"`
	Barcode         string             `bson:"barcode,omitempty" json:"barcode,omitempty"`
	Stock           int                `bson:"stock" json:"stock"`
	Active          *bool              `bson:"active,omitempty" json:"active,omitempty"`
	Featured        bool               `bson:"featured,omitempty" json:"featured,omitempty"`
	PriceTiers      []PriceTier        `bson:"priceTiers,omitempty" json:"priceTiers,omitempty"`
	GroupIDs        []string           `bson:"groupIDs,omitempty" json:"groupIDs,omitempty"`
	Attributes      []Attribute        `bson:"attributes,omitempty" json:"attributes,omitempty"`
	Rating          *Rating            `bson:"rating,omitempty" json:"rating,omitempty"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
}

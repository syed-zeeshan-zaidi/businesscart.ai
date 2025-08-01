package storage

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty"`
	Name                string             `bson:"name"`
	Email               string             `bson:"email"`
	Password            string             `bson:"password"`
	Role                string             `bson:"role"`
	PhoneNumber         string             `bson:"phoneNumber,omitempty"`
	CompanyID           string             `bson:"company_id,omitempty"`
	AssociateCompanyIDs []string           `bson:"associate_company_ids,omitempty"`
}

type RefreshToken struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    primitive.ObjectID `bson:"userId"`
	Token     string             `bson:"token"`
	ExpiresAt primitive.DateTime `bson:"expiresAt"`
}

type BlacklistedToken struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Token     string             `bson:"token"`
	ExpiresAt primitive.DateTime `bson:"expiresAt"`
}

type BusinessCode struct {
	ID                primitive.ObjectID `bson:"_id,omitempty"`
	BusinessCode      string             `bson:"business_code"`
	CompanyAccessCode string             `bson:"company_access_code"`
	CompanyID         string             `bson:"company_id"`
}

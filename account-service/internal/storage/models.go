package storage

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ---------- constants ----------
const (
	RoleAdmin    = "admin"
	RoleCompany  = "company"
	RoleCustomer = "customer"
	RolePartner  = "partner"
)

type AccountStatus string

const (
	AccountActive    AccountStatus = "active"
	AccountPending   AccountStatus = "pending"
	AccountSuspended AccountStatus = "suspended"
	AccountInactive  AccountStatus = "inactive"
)

// ---------- shared ----------
type Coords struct {
	Lat float64 `bson:"lat" json:"lat"`
	Lng float64 `bson:"lng" json:"lng"`
}

type Address struct {
	Street string `bson:"street" json:"street"`
	City   string `bson:"city" json:"city"`
	State  string `bson:"state" json:"state"`
	Zip    string `bson:"zip" json:"zip"`
	Coords Coords `bson:"coordinates" json:"coordinates"`
}

// ---------- role sub-docs ----------
type CompanyData struct {
	Name           string   `bson:"name" json:"name"`
	CompanyCodeID  string   `bson:"companyCodeId,omitempty" json:"companyCodeId,omitempty"`
	CompanyCode    string   `bson:"companyCode" json:"companyCode"`
	PaymentMethods []string `bson:"paymentMethods" json:"paymentMethods"`
	Address        Address  `bson:"address" json:"address"`
	SellingArea    struct {
		Radius float64 `bson:"radius" json:"radius"`
		Center Coords  `bson:"center" json:"center"`
	} `bson:"sellingArea" json:"sellingArea"`
	Status string `bson:"status" json:"status"`
}

type CustomerCodeEntry struct {
	CodeID string `bson:"codeId" json:"codeId"`
	Code   string `bson:"customerCode" json:"customerCode"`
}

type CustomerData struct {
	CustomerCodes     []CustomerCodeEntry   `bson:"customerCodes" json:"customerCodes"`
	AttachedCompanies []CompanyData `bson:"attachedCompanies,omitempty" json:"attachedCompanies,omitempty"`
}

type PartnerData struct {
	PartnerCodeID string `bson:"partnerCodeId,omitempty" json:"partnerCodeId,omitempty"`
	PartnerCode   string `bson:"partnerCode,omitempty" json:"partnerCode,omitempty"`
	Status        string `bson:"status" json:"status"`
}

// ---------- unified account ----------
type Account struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Name          string             `bson:"name" json:"name"`
	Email         string             `bson:"email" json:"email"`
	Password      string             `bson:"password" json:"-"` // Do not expose password
	Role          string             `bson:"role" json:"role"`
	AccountStatus AccountStatus      `bson:"accountStatus" json:"accountStatus"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt" json:"updatedAt"`

	CompanyData  *CompanyData  `bson:"company,omitempty" json:"company,omitempty"`
	CustomerData *CustomerData `bson:"customer,omitempty" json:"customer,omitempty"`
	PartnerData  *PartnerData  `bson:"partner,omitempty" json:"partner,omitempty"`
	Address      *Address      `bson:"address,omitempty" json:"address,omitempty"`
}

// ---------- code & auth ----------
type Code struct {
	ID           primitive.ObjectID `bson:"_id,omitempty"`
	CompanyCode  string             `bson:"companyCode"`
	CustomerCode string             `bson:"customerCode"`
	PartnerCode  string             `bson:"partnerCode,omitempty"`
	IsClaimed    bool               `bson:"is_claimed"`
	CreatedAt    time.Time          `bson:"createdAt"`
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

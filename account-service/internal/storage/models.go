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

type PaymentMethod string

const (
	CreditCard    PaymentMethod = "credit_card"
	PurchaseOrder PaymentMethod = "purchase_order"
	AmazonPay     PaymentMethod = "amazon_pay"
	GooglePay     PaymentMethod = "google_pay"
	StripePay     PaymentMethod = "stripe_pay"
	PickupPay     PaymentMethod = "pickup_pay"
	DeliverPay    PaymentMethod = "deliver_pay"
)

type DeliveryMethod string

const (
	pickupDelivery      DeliveryMethod = "pickup"
	dropoffDelivery     DeliveryMethod = "dropoff"
	shippingOutDelivery DeliveryMethod = "shipping_out"
)

type ShippingOutOption string

const (
	StandardShippingOut ShippingOutOption = "standard"
	ExpressShippingOut  ShippingOutOption = "express"
)

// New structs for multiple locations/addresses
type CompanyLocation struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CompanyID      primitive.ObjectID `bson:"companyId" json:"companyId"` // Reference to the Company's Account ID
	LocationName   string             `bson:"locationName" json:"locationName"`
	Address        Address            `bson:"address" json:"address"` // Re-use existing Address struct
	ContactPerson  string             `bson:"contactPerson,omitempty" json:"contactPerson,omitempty"`
	PhoneNumber    string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	OperatingHours string             `bson:"operatingHours,omitempty" json:"operatingHours,omitempty"` // e.g., "Mon-Fri 9-5"
	Capacity       string             `bson:"capacity,omitempty" json:"capacity,omitempty"` // e.g., "5000 sq ft", "100 pallets"
	LocationType   string             `bson:"locationType" json:"locationType"` // e.g., "pickup", "warehouse", "storefront"
	IsDefault      bool               `bson:"isDefault" json:"isDefault"` // Flag for default location
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type CustomerAddress struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CustomerID         primitive.ObjectID `bson:"customerId" json:"customerId"` // Reference to the Customer's Account ID
	RecipientName      string             `bson:"recipientName" json:"recipientName"`
	Address            Address            `bson:"address" json:"address"` // Re-use existing Address struct
	PhoneNumber        string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	AddressLabel       string             `bson:"addressLabel,omitempty" json:"addressLabel,omitempty"` // e.g., "Home", "Work"
	IsDefaultShipping  bool               `bson:"isDefaultShipping" json:"isDefaultShipping"` // Flag for default shipping address
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// ---------- role sub-docs ----------
type CompanyData struct {
	Name                  string              `bson:"name" json:"name"`
	Status                string              `bson:"status" json:"status"`
	UniqueIdentifier      string              `bson:"uniqueIdentifier" json:"uniqueIdentifier"`
	SaleRepresentative    string              `bson:"saleRepresentative" json:"saleRepresentative"`
	CreditLimit           float64             `bson:"creditLimit" json:"creditLimit"`
	LeadTime              float64             `bson:"leadTime" json:"leadTime"`
	MaxOrderAmountLimit   float64             `bson:"maxOrderAmountLimit" json:"maxOrderAmountLimit"`
	MaxOrderQuantityLimit float64             `bson:"maxOrderQuantityLimit" json:"maxOrderQuantityLimit"`
	MinOrderAmountLimit   float64             `bson:"minOrderAmountLimit" json:"minOrderAmountLimit"`
	MinOrderQuantityLimit float64             `bson:"minOrderQuantityLimit" json:"minOrderQuantityLimit"`
	MonthlyOrderLimit     float64             `bson:"monthlyOrderLimit" json:"monthlyOrderLimit"`
	YearlyOrderLimit      float64             `bson:"yearlyOrderLimit" json:"yearlyOrderLimit"`
	TaxableGoods          bool                `bson:"taxableGoods" json:"taxableGoods"`
	QuotesAllowed         bool                `bson:"quotesAllowed" json:"quotesAllowed"`
	CompanyCodeID         string              `bson:"companyCodeId,omitempty" json:"companyCodeId,omitempty"`
	CompanyCode           string              `bson:"companyCode" json:"companyCode"`
	ShippingOutOptions    []ShippingOutOption `bson:"shippingOutOptions" json:"shippingOutOptions"`
	PaymentMethods        []PaymentMethod     `bson:"paymentMethods" json:"paymentMethods"`
	DeliveryMethods       []DeliveryMethod    `bson:"deliveryMethods" json:"deliveryMethods"`
	SellingArea           struct {
		Radius float64 `bson:"radius" json:"radius"`
		Center Coords  `bson:"center" json:"center"`
	} `bson:"sellingArea" json:"sellingArea"`
	Address Address `bson:"address" json:"address"` // Company's primary address

	// New fields for multiple locations
	LocationIDs           []primitive.ObjectID `bson:"locationIds,omitempty" json:"locationIds,omitempty"`
	DefaultPickupLocation *CompanyLocation     `bson:"defaultPickupLocation,omitempty" json:"defaultPickupLocation,omitempty"`
	DefaultWarehouseLocation *CompanyLocation  `bson:"defaultWarehouseLocation,omitempty" json:"defaultWarehouseLocation,omitempty"`
}

type CustomerCodeEntry struct {
	CodeID string `bson:"codeId" json:"codeId"`
	Code   string `bson:"customerCode" json:"customerCode"`
}

type CustomerData struct {
	CustomerCodes     []CustomerCodeEntry `bson:"customerCodes" json:"customerCodes"`
	AttachedCompanies []CompanyData       `bson:"attachedCompanies,omitempty" json:"attachedCompanies,omitempty"`

	// New fields for multiple addresses
	AddressIDs            []primitive.ObjectID `bson:"addressIds,omitempty" json:"addressIds,omitempty"`
	DefaultShippingAddress *CustomerAddress    `bson:"defaultShippingAddress,omitempty" json:"defaultShippingAddress,omitempty"`
	RecentShippingAddresses []*CustomerAddress `bson:"recentShippingAddresses,omitempty" json:"recentShippingAddresses,omitempty"` // Bounded list
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
	Address      *Address      `bson:"address,omitempty" json:"address,omitempty"` // Account holder's primary address
}

// ---------- code & auth ----------
type Code struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CompanyCode  string             `bson:"companyCode" json:"companyCode"`
	CustomerCode string             `bson:"customerCode" json:"customerCode"`
	PartnerCode  string             `bson:"partnerCode,omitempty" json:"partnerCode,omitempty"`
	IsClaimed    bool               `bson:"is_claimed" json:"isClaimed"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
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
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
	RoleB2C      = "b2c"
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
	PickupPay     PaymentMethod = "pickup_&_pay"
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

// D2CConfig defines the branding and configuration for a company's B2C/D2C storefront.
type D2CConfig struct {
	Enabled        bool   `bson:"enabled" json:"enabled"`
	PrimaryColor   string `bson:"primaryColor" json:"primaryColor"`     // e.g., "#000000"
	SecondaryColor string `bson:"secondaryColor" json:"secondaryColor"` // e.g., "#FFFFFF"
	PreviewDomain  string `bson:"previewDomain" json:"previewDomain"`   // e.g., "alpha.businesscart.ai"
	CustomDomain   string `bson:"customDomain" json:"customDomain"`     // e.g., "shop.alphacorp.com"
	ContactEmail   string `bson:"contactEmail" json:"contactEmail"`
	ContactPhone   string `bson:"contactPhone" json:"contactPhone"`
	HeroTitle      string `bson:"heroTitle" json:"heroTitle"`
	HeroSlogan     string `bson:"heroSlogan" json:"heroSlogan"`
	HeroTextColor  string `bson:"heroTextColor" json:"heroTextColor"`
	HeroBgColor    string `bson:"heroBgColor" json:"heroBgColor"`
	AboutText      string `bson:"aboutText" json:"aboutText"`
	PrivacyText    string `bson:"privacyText" json:"privacyText"`
	TermsText      string `bson:"termsText" json:"termsText"`
	ShippingText   string `bson:"shippingText" json:"shippingText"`
	ShippingBadge  string `bson:"shippingBadge,omitempty" json:"shippingBadge,omitempty"` // Product page trust signal (default: "Shipping Available")
	ReturnsBadge   string `bson:"returnsBadge,omitempty" json:"returnsBadge,omitempty"`   // Product page trust signal (default: "Returns & Refunds")
	FeedGender     string `bson:"feedGender,omitempty" json:"feedGender,omitempty"`       // Default gender for feeds (e.g. "Unisex", "Male", "Female")
	FeedAgeGroup   string `bson:"feedAgeGroup,omitempty" json:"feedAgeGroup,omitempty"`   // Default age group for feeds (e.g. "Adult", "Kids")
	WhatsappNumber string `bson:"whatsappNumber" json:"whatsappNumber"`
	FacebookURL    string `bson:"facebookUrl" json:"facebookUrl"`
	InstagramURL   string `bson:"instagramUrl" json:"instagramUrl"`
	TwitterURL     string `bson:"twitterUrl" json:"twitterUrl"`
	LinkedinURL    string `bson:"linkedinUrl" json:"linkedinUrl"`
	TiktokURL      string `bson:"tiktokUrl" json:"tiktokUrl"`
}

// Multiple locations/addresses for Account role companies
type CompanyLocation struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CompanyID      primitive.ObjectID `bson:"companyId" json:"companyId"` // Reference to the Company's Account ID
	LocationName   string             `bson:"locationName" json:"locationName"`
	Address        Address            `bson:"address" json:"address"` // Re-use existing Address struct
	ContactPerson  string             `bson:"contactPerson,omitempty" json:"contactPerson,omitempty"`
	PhoneNumber    string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	OperatingHours string             `bson:"operatingHours,omitempty" json:"operatingHours,omitempty"` // e.g., "Mon-Fri 9-5"
	Capacity       string             `bson:"capacity,omitempty" json:"capacity,omitempty"`             // e.g., "5000 sq ft", "100 pallets"
	LocationType   string             `bson:"locationType" json:"locationType"`                         // e.g., "pickup", "warehouse", "storefront"
	IsDefault      bool               `bson:"isDefault" json:"isDefault"`                               // Flag for default location
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// Multiple addresses for Account role customers
type CustomerAddress struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CustomerID        primitive.ObjectID `bson:"customerId" json:"customerId"` // Reference to the Customer's Account ID
	RecipientName     string             `bson:"recipientName" json:"recipientName"`
	Address           Address            `bson:"address" json:"address"` // Re-use existing Address struct
	PhoneNumber       string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	AddressLabel      string             `bson:"addressLabel,omitempty" json:"addressLabel,omitempty"` // e.g., "Home", "Work"
	IsDefaultShipping bool               `bson:"isDefaultShipping" json:"isDefaultShipping"`           // Flag for default shipping address
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// CustomerGroup defines a B2B customer segment with a uniform discount.
// Stored on CompanyData as a small embedded array (max 5 enforced at handler).
type CustomerGroup struct {
	ID                 string  `bson:"id" json:"id"`
	Name               string  `bson:"name" json:"name"`
	GroupPriceDiscount float64 `bson:"groupPriceDiscount,omitempty" json:"groupPriceDiscount,omitempty"`
}

// Full company data sub-docs for Account role companies
type CompanyData struct {
	Name                  string              `bson:"name" json:"name"`
	LogoURL               string              `bson:"logoUrl" json:"logoUrl"`
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
	TaxRate               float64             `bson:"taxRate,omitempty" json:"taxRate,omitempty"`
	ShippingRate          float64             `bson:"shippingRate,omitempty" json:"shippingRate,omitempty"`
	QuotesAllowed         bool                `bson:"quotesAllowed" json:"quotesAllowed"`
	CouponsEnabled        bool                `bson:"couponsEnabled,omitempty" json:"couponsEnabled,omitempty"`
	CompanyCodeID         string              `bson:"companyCodeId,omitempty" json:"companyCodeId,omitempty"`
	CompanyCode           string              `bson:"companyCode" json:"companyCode"`
	PartnerCode           string              `bson:"-" json:"partnerCode,omitempty"`
	ShippingOutOptions    []ShippingOutOption `bson:"shippingOutOptions" json:"shippingOutOptions"`
	PaymentMethods        []PaymentMethod     `bson:"paymentMethods" json:"paymentMethods"`
	DeliveryMethods       []DeliveryMethod    `bson:"deliveryMethods" json:"deliveryMethods"`
	SellingArea           struct {
		Radius float64 `bson:"radius" json:"radius"`
		Center Coords  `bson:"center" json:"center"`
	} `bson:"sellingArea" json:"sellingArea"`
	Address        Address         `bson:"address" json:"address"` // Company's primary address
	D2C            *D2CConfig      `bson:"d2c,omitempty" json:"d2c,omitempty"`
	CustomerGroups []CustomerGroup `bson:"customerGroups,omitempty" json:"customerGroups,omitempty"`
	Feeds          []string        `bson:"feeds,omitempty" json:"feeds,omitempty"`
}

// GetAccountCompaniesDataByIDs retrieves company data for multiple accounts by their IDs. Transactional data retrieval for accounts role customers.
type AttachedCompaniesData struct {
	Name                  string              `json:"name"`
	LogoURL               string              `json:"logoUrl"`
	CompanyCodeID         string              `json:"companyCodeId,omitempty"`
	CompanyCode           string              `json:"companyCode"`
	SaleRepresentative    string              `json:"saleRepresentative"`
	Address               Address             `json:"address"`
	CreditLimit           float64             `json:"creditLimit"`
	LeadTime              float64             `json:"leadTime"`
	MinOrderAmountLimit   float64             `json:"minOrderAmountLimit"`
	MaxOrderAmountLimit   float64             `json:"maxOrderAmountLimit"`
	MinOrderQuantityLimit float64             `json:"minOrderQuantityLimit"`
	MaxOrderQuantityLimit float64             `json:"maxOrderQuantityLimit"`
	MonthlyOrderLimit     float64             `json:"monthlyOrderLimit"`
	YearlyOrderLimit      float64             `json:"yearlyOrderLimit"`
	TaxableGoods          bool                `json:"taxableGoods"`
	TaxRate               float64             `json:"taxRate,omitempty"`
	ShippingRate          float64             `json:"shippingRate,omitempty"`
	Status                string              `json:"status"`
	QuotesAllowed         bool                `bson:"quotesAllowed" json:"quotesAllowed"`
	CouponsEnabled        bool                `bson:"couponsEnabled,omitempty" json:"couponsEnabled,omitempty"`
	ShippingOutOptions    []ShippingOutOption `bson:"shippingOutOptions" json:"shippingOutOptions"`
	PaymentMethods        []PaymentMethod     `bson:"paymentMethods" json:"paymentMethods"`
	DeliveryMethods       []DeliveryMethod    `bson:"deliveryMethods" json:"deliveryMethods"`
	CompanyLocations      []CompanyLocation   `json:"companyLocations,omitempty"`
}

// CustomerConfiguration defines specific settings that override a company's defaults for a single customer.
type CustomerConfiguration struct {
	DiscountPercentage    *float64             `bson:"discountPercentage,omitempty" json:"discountPercentage,omitempty"`
	PaymentMethods        *[]PaymentMethod     `bson:"paymentMethods,omitempty" json:"paymentMethods,omitempty"`
	DeliveryMethods       *[]DeliveryMethod    `bson:"deliveryMethods,omitempty" json:"deliveryMethods,omitempty"`
	ShippingOutOptions    *[]ShippingOutOption `bson:"shippingOutOptions,omitempty" json:"shippingOutOptions,omitempty"`
	QuotesAllowed         *bool                `bson:"quotesAllowed,omitempty" json:"quotesAllowed,omitempty"`
	CouponsEnabled        *bool                `bson:"couponsEnabled,omitempty" json:"couponsEnabled,omitempty"`
	CreditLimit           *float64             `bson:"creditLimit,omitempty" json:"creditLimit,omitempty"`
	MinOrderAmountLimit   *float64             `bson:"minOrderAmountLimit,omitempty" json:"minOrderAmountLimit,omitempty"`
	MaxOrderAmountLimit   *float64             `bson:"maxOrderAmountLimit,omitempty" json:"maxOrderAmountLimit,omitempty"`
	MinOrderQuantityLimit *float64             `bson:"minOrderQuantityLimit,omitempty" json:"minOrderQuantityLimit,omitempty"`
	MaxOrderQuantityLimit *float64             `bson:"maxOrderQuantityLimit,omitempty" json:"maxOrderQuantityLimit,omitempty"`
	MonthlyOrderLimit     *float64             `bson:"monthlyOrderLimit,omitempty" json:"monthlyOrderLimit,omitempty"`
	YearlyOrderLimit      *float64             `bson:"yearlyOrderLimit,omitempty" json:"yearlyOrderLimit,omitempty"`
	TaxableGoods          *bool                `bson:"taxableGoods,omitempty" json:"taxableGoods,omitempty"`
	TaxRate               *float64             `bson:"taxRate,omitempty" json:"taxRate,omitempty"`
	ShippingRate          *float64             `bson:"shippingRate,omitempty" json:"shippingRate,omitempty"`
	LeadTime              *float64             `bson:"leadTime,omitempty" json:"leadTime,omitempty"`
	ResaleCertificate     *ResaleCertificate   `bson:"resaleCertificate,omitempty" json:"resaleCertificate,omitempty"`
}

// OrgGovernance is an account's OWN internal structure: how IT governs ITS
// people and spending. It hangs off Account rather than CompanyData or
// CustomerData deliberately, so it is role-agnostic — a selling company, a
// buying customer and (later) a partner all describe themselves the same way,
// and neither side configures the other's internals.
//
// Deliberately a container, not a bare field. The roadmap's remaining B2B org
// work all lands inside it without reshaping anything: buyer roles/permissions
// (#35g) become Members, account hierarchy / divisions (#35h) becomes a parent
// reference, cost centres and spend allocation (#35i) become another sub-object,
// and punchout (#22) maps an inbound procurement identity onto the same Members.
// Adding those is additive; nothing already stored has to move.
//
// Never populated for RoleB2C: a D2C shopper is a person, not an organisation.
type OrgGovernance struct {
	Approval *ApprovalPolicy `bson:"approval,omitempty" json:"approval,omitempty"`
	// Reserved, in name only, for the roadmap items above:
	//   Members       []OrgMember    (#35g buyer roles / punchout identities)
	//   ParentAccount string         (#35h hierarchy, divisions)
	//   CostCenters   []CostCenter   (#35i spend allocation)
}

// ApprovalPolicy is how an organisation gates its OWN spending. Set by that
// organisation, never by the party on the other side of the trade.
type ApprovalPolicy struct {
	Scope             string               `bson:"scope,omitempty" json:"scope,omitempty"`
	Threshold         float64              `bson:"threshold,omitempty" json:"threshold,omitempty"`
	QuantityThreshold float64              `bson:"quantityThreshold,omitempty" json:"quantityThreshold,omitempty"`
	ValidityHours     float64              `bson:"validityHours,omitempty" json:"validityHours,omitempty"`
	Chain             []ApprovalStepConfig `bson:"chain,omitempty" json:"chain,omitempty"`
}

// ApprovalScope values. Mirrors the existing quoteType vocabulary so a scope can
// be compared directly against a quote's type.
const (
	ApprovalScopeNone       = "none"
	ApprovalScopeStandard   = "standard"
	ApprovalScopeNegotiable = "negotiable"
	ApprovalScopeBoth       = "both"
)

// ApprovalStepConfig is one tier of an approval chain. Several approvers may sit
// on a step and ANY ONE of them clears it — that is what keeps an order moving
// when someone is on leave, without needing a scheduler to escalate.
type ApprovalStepConfig struct {
	Name      string     `bson:"name,omitempty" json:"name,omitempty"`
	Approvers []Approver `bson:"approvers,omitempty" json:"approvers,omitempty"`
}

// Approver identifies a customer account that may sign off on an order. Email and
// name are stored alongside the ID so checkout-service can address the approval
// email off its own denormalised copy, never calling account-service.
type Approver struct {
	AccountID string `bson:"accountId" json:"accountId"`
	Email     string `bson:"email,omitempty" json:"email,omitempty"`
	Name      string `bson:"name,omitempty" json:"name,omitempty"`
}

// ResaleCertificate records the compliance document that justifies a tax-exempt
// (TaxRate = 0) B2B customer. Metadata only: the platform stores the reference
// details so an admin can see a valid certificate is on file before exempting a
// buyer; it is not resolved into the JWT or used at checkout, and the document
// file itself is kept in the seller's own records.
type ResaleCertificate struct {
	State      string `bson:"state,omitempty" json:"state,omitempty"`
	Number     string `bson:"number,omitempty" json:"number,omitempty"`
	Type       string `bson:"type,omitempty" json:"type,omitempty"`
	IssueDate  string `bson:"issueDate,omitempty" json:"issueDate,omitempty"`
	ExpiryDate string `bson:"expiryDate,omitempty" json:"expiryDate,omitempty"`
}

type CustomerCodeEntry struct {
	CodeID        string                 `bson:"codeId" json:"codeId"`
	Code          string                 `bson:"customerCode" json:"customerCode"`
	GroupID       string                 `bson:"groupID,omitempty" json:"groupID,omitempty"`
	Configuration *CustomerConfiguration `bson:"configuration,omitempty" json:"configuration,omitempty"`
}

// Final Full customer data sub-docs for Account role customers
type CustomerData struct {
	CustomerConfigs   []CustomerCodeEntry     `bson:"customerConfigs" json:"customerConfigs"`
	AttachedCompanies []AttachedCompaniesData `bson:"attachedCompanies,omitempty" json:"attachedCompanies,omitempty"`
	CustomerAddresses []CustomerAddress       `bson:"customerAddresses,omitempty" json:"customerAddresses,omitempty"`
}

type PartnerData struct {
	PartnerCodeID string `bson:"partnerCodeId,omitempty" json:"partnerCodeId,omitempty"`
	PartnerCode   string `bson:"partnerCode,omitempty" json:"partnerCode,omitempty"`
	Status        string `bson:"status" json:"status"`
	CompanyID     string `bson:"companyId,omitempty" json:"companyId,omitempty"`
}

// Full Account Document structure
type Account struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	Name          string             `bson:"name" json:"name"`
	Email         string             `bson:"email" json:"email"`
	PhoneNumber   string             `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	Password      string             `bson:"password" json:"-"` // Do not expose password
	Role          string             `bson:"role" json:"role"`
	AccountStatus AccountStatus      `bson:"accountStatus" json:"accountStatus"`
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt     time.Time          `bson:"updatedAt" json:"updatedAt"`
	// Set on successful login and nothing else. Deliberately does NOT touch
	// UpdatedAt: UpdatedAt answers "was this account ever configured" and
	// LastLogin answers "did they ever come back", so collapsing them would
	// destroy both signals. Absent means no login since this field shipped.
	LastLogin *time.Time `bson:"lastLogin,omitempty" json:"lastLogin,omitempty"`
	// The code colleagues use to join this organisation. Only ever set on a root
	// account, generated on request and rotatable, so a leaked code can be
	// invalidated without disturbing the people who already joined.
	OrgInviteCode string `bson:"orgInviteCode,omitempty" json:"orgInviteCode,omitempty"`
	// This account's standing INSIDE its organisation, as opposed to Role which
	// is its standing on the platform. Roadmap #35(g) refines this into real
	// permissions; today it distinguishes who may manage the organisation.
	OrgRole string `bson:"orgRole,omitempty" json:"orgRole,omitempty"`
	// Organisation membership (Roadmap #21c). When set, this account belongs to
	// the organisation rooted at that account; when absent, the account IS its own
	// organisation. That default is what lets this ship inert: every existing
	// account resolves to an OrgID equal to its own id, so nothing behaves
	// differently until a parent is actually assigned.
	ParentAccountID string `bson:"parentAccountId,omitempty" json:"parentAccountId,omitempty"`
	// The account's own internal governance (approvals today; buyer roles,
	// hierarchy and cost centres later). Role-agnostic on purpose — see
	// OrgGovernance. omitempty throughout so an account that has never
	// configured anything stores no key at all.
	Governance       *OrgGovernance `bson:"governance,omitempty" json:"governance,omitempty"`
	CompanyData      *CompanyData   `bson:"company,omitempty" json:"company,omitempty"`
	CustomerData     *CustomerData  `bson:"customer,omitempty" json:"customer,omitempty"`
	PartnerData      *PartnerData   `bson:"partner,omitempty" json:"partner,omitempty"`
	Address          *Address       `bson:"address,omitempty" json:"address,omitempty"` // Account holder's primary address
	ResetToken       string         `bson:"resetToken,omitempty" json:"-"`
	ResetTokenExpiry *time.Time     `bson:"resetTokenExpiry,omitempty" json:"-"`
	// AdConversions holds per-provider ad-platform conversion credentials for a
	// company account: provider ("meta") -> {field ("pixel_id"/"access_token")
	// -> AES-GCM-encrypted value}. json:"-" so the secret token is never
	// serialized in any API response. Read by the conversion dispatcher via
	// GetAccountByID(sellerID); set via PATCH /accounts/{id}.
	AdConversions map[string]map[string]string `bson:"adConversions,omitempty" json:"-"`
	// AdConversionsEnabled is the per-provider on/off switch. A provider only
	// dispatches when enabled is true (absent = off), so a company can configure
	// credentials but keep sending paused.
	AdConversionsEnabled map[string]bool `bson:"adConversionsEnabled,omitempty" json:"-"`
	// AdConversionsInfo is a computed, secret-free view for the admin UI
	// (configured + enabled + pixelId + token last-4). Never persisted (bson:"-").
	AdConversionsInfo map[string]AdConversionInfo `bson:"-" json:"adConversionsInfo,omitempty"`
}

// OrgID is the organisation this account acts within.
//
// Every seller-scoped record (products, quotes, orders, statements, storefronts)
// is keyed by the ROOT account's id, so authorisation must compare against this
// rather than the caller's own id — otherwise a second account in the same
// organisation is locked out of its own company's data. An account with no
// parent is its own organisation, which keeps every existing single-account
// organisation behaving exactly as before.
// Standing inside an organisation. A root account (no parent) is the owner
// implicitly.
//
// "user" rather than "member" to match the market: Adobe Commerce calls these
// company users, OroCommerce customer users. The portal labels them by side —
// a selling company's people are Staff, a buying organisation's are Company
// users — because they are two different populations and calling a customer's
// buyers "staff" in a merchant portal reads as though they work for the seller.
const (
	OrgRoleOwner = "owner"
	OrgRoleAdmin = "admin"
	OrgRoleUser  = "user"
)

// IsOrgRoot reports whether this account IS the organisation rather than a
// member of one. The root's id is the OrgID every seller-scoped record is keyed
// by, which is why only it may hand out invite codes.
// EffectiveOrgRole is this account's seniority inside its organisation.
//
// DERIVED, never migrated. The root of an organisation IS its owner by
// definition, so there is nothing to backfill: every account that exists today is
// its own root and resolves to owner, keeping exactly the access it already has.
// Only accounts that joined someone else's organisation are constrained, and a
// stored value is only ever needed to promote one of those to admin.
//
// Anything unrecognised resolves to the LEAST privileged role. A permission that
// fails open because a field was empty or misspelled is not a permission.
func (a *Account) EffectiveOrgRole() string {
	if a.IsOrgRoot() {
		return OrgRoleOwner
	}
	if a.OrgRole == OrgRoleAdmin {
		return OrgRoleAdmin
	}
	return OrgRoleUser
}

func (a *Account) IsOrgRoot() bool {
	return a.ParentAccountID == ""
}

func (a *Account) OrgID() string {
	if a.ParentAccountID != "" {
		return a.ParentAccountID
	}
	return a.ID.Hex()
}

// AdConversionInfo is the masked, display-safe status of a provider's creds.
// Non-secret identifiers (pixelId, customerId, conversionActionId) are shown in
// full; the sensitive token/secret is only ever hinted at as its last 4 chars.
type AdConversionInfo struct {
	Configured bool `json:"configured"`
	Enabled    bool `json:"enabled"`
	// Meta
	PixelID string `json:"pixelId,omitempty"`
	// Google
	CustomerID          string `json:"customerId,omitempty"`
	ConversionActionID  string `json:"conversionActionId,omitempty"`
	ViewContentActionID string `json:"viewContentActionId,omitempty"`
	AddToCartActionID   string `json:"addToCartActionId,omitempty"`
	CheckoutActionID    string `json:"checkoutActionId,omitempty"`
	// Sensitive-token last-4 hint (Meta access_token / Google refresh_token).
	TokenLast4 string `json:"tokenLast4,omitempty"`
}

// ---------- visitor analytics ----------

type VisitorAttribution struct {
	Source      string            `bson:"source" json:"source"`
	Medium      string            `bson:"medium" json:"medium"`
	Campaign    string            `bson:"campaign,omitempty" json:"campaign,omitempty"`
	Content     string            `bson:"content,omitempty" json:"content,omitempty"`
	Term        string            `bson:"term,omitempty" json:"term,omitempty"`
	Referrer    string            `bson:"referrer,omitempty" json:"referrer,omitempty"`
	LandingPage string            `bson:"landingPage" json:"landingPage"`
	ClickIDs    map[string]string `bson:"clickIds,omitempty" json:"clickIds,omitempty"`
}

type VisitorGeo struct {
	Country  string `bson:"country,omitempty" json:"country,omitempty"`
	Region   string `bson:"region,omitempty" json:"region,omitempty"`
	City     string `bson:"city,omitempty" json:"city,omitempty"`
	Timezone string `bson:"timezone,omitempty" json:"timezone,omitempty"`
	IP       string `bson:"ip,omitempty" json:"ip,omitempty"`
	ASN      string `bson:"asn,omitempty" json:"asn,omitempty"`
}

type VisitorMilestone struct {
	Event    string                 `bson:"event" json:"event"`
	Page     string                 `bson:"page,omitempty" json:"page,omitempty"`
	Date     time.Time              `bson:"date" json:"date"`
	Metadata map[string]interface{} `bson:"metadata,omitempty" json:"metadata,omitempty"`
}

type Visitor struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	VisitorID      string             `bson:"visitorId" json:"visitorId"`
	SellerID       string             `bson:"sellerId,omitempty" json:"sellerId,omitempty"`
	Attribution    VisitorAttribution `bson:"attribution" json:"attribution"`
	Geo            VisitorGeo         `bson:"geo" json:"geo"`
	Device         string             `bson:"device" json:"device"`
	OS             string             `bson:"os,omitempty" json:"os,omitempty"`
	Browser        string             `bson:"browser,omitempty" json:"browser,omitempty"`
	ScreenWidth    int                `bson:"screenWidth,omitempty" json:"screenWidth,omitempty"`
	ScreenHeight   int                `bson:"screenHeight,omitempty" json:"screenHeight,omitempty"`
	Language       string             `bson:"language,omitempty" json:"language,omitempty"`
	IsBot          bool               `bson:"isBot" json:"isBot"`
	BotName        string             `bson:"botName,omitempty" json:"botName,omitempty"`
	FirstVisit     time.Time          `bson:"firstVisit" json:"firstVisit"`
	LastVisit      time.Time          `bson:"lastVisit" json:"lastVisit"`
	TotalSessions  int                `bson:"totalSessions" json:"totalSessions"`
	TotalPageViews int                `bson:"totalPageViews" json:"totalPageViews"`
	Pages          []string           `bson:"pages" json:"pages"`
	Milestones     []VisitorMilestone `bson:"milestones" json:"milestones"`
	CustomerID     string             `bson:"customerId,omitempty" json:"customerId,omitempty"`
	Registered     bool               `bson:"registered" json:"registered"`
	RegisteredAt   *time.Time         `bson:"registeredAt,omitempty" json:"registeredAt,omitempty"`
	Ordered        bool               `bson:"ordered" json:"ordered"`
	FirstOrderAt   *time.Time         `bson:"firstOrderAt,omitempty" json:"firstOrderAt,omitempty"`
	TotalOrders    int                `bson:"totalOrders" json:"totalOrders"`
	TotalRevenue   float64            `bson:"totalRevenue" json:"totalRevenue"`
	// ViewContentSent tallies successful ViewContent CAPI sends for this visitor.
	// Counter (not a per-view milestone) to avoid unbounded milestones[] growth.
	ViewContentSent int       `bson:"viewContentSent,omitempty" json:"viewContentSent,omitempty"`
	DaysToRegister  *int      `bson:"daysToRegister,omitempty" json:"daysToRegister,omitempty"`
	DaysToOrder     *int      `bson:"daysToOrder,omitempty" json:"daysToOrder,omitempty"`
	ErrorLog        []string  `bson:"errorLog,omitempty" json:"errorLog,omitempty"`
	CreatedAt       time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time `bson:"updatedAt" json:"updatedAt"`
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

// ---------- Handler Request Structs ----------

type CreateCodeRequest struct {
	CompanyCode  string `json:"companyCode"`
	CustomerCode string `json:"customerCode"`
	PartnerCode  string `json:"partnerCode,omitempty"`
}

type RegisterRequest struct {
	Name          string   `json:"name"`
	Email         string   `json:"email"`
	Password      string   `json:"password"`
	Role          string   `json:"role"`
	Code          string   `json:"code"`
	CustomerCodes []string `json:"customerCodes"`
	PhoneNumber   string   `json:"phoneNumber,omitempty"`
	// Joining an existing organisation as a colleague (Roadmap #21c Phase 2).
	// Multi-use, like the customer and partner codes: one organisation, many
	// people. Supplying it makes every other role/code field irrelevant, because
	// a member inherits both from the organisation they are joining.
	OrgInviteCode string `json:"orgInviteCode,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AssociateCustomerRequest struct {
	CustomerCode string `json:"customerCode"`
}

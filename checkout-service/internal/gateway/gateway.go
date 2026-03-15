package gateway

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Gateway defines the interface for payment gateway implementations.
type Gateway interface {
	CreateSession(ctx context.Context, req SessionRequest) (*SessionResponse, error)
	CompleteSession(ctx context.Context, providerSessionID string, invoiceRef string, amount float64, currency string, credentials map[string]string, sandbox bool) (*CompletionResponse, error)
	ValidateCredentials(credentials map[string]string) error
}

type SessionRequest struct {
	Amount      float64
	Currency    string
	CallbackURL string
	Credentials map[string]string
	MerchantRef string
	Sandbox     bool
}

type SessionResponse struct {
	ProviderSessionID string
	RedirectURL       string            // For redirect-based gateways (Stripe, Authorize.net)
	InvoiceRef        string            // Provider-side reference for transaction lookup
	ButtonConfig      map[string]string // For button-based gateways (Amazon Pay) — frontend renders the button
}

type CompletionResponse struct {
	TransactionID string
	Status        string // "completed", "pending", "failed"
	ProviderRef   string
}

// GatewayConfig stored in DB per company per gateway.
type GatewayConfig struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	SellerID           string             `bson:"sellerId" json:"sellerId"`
	Gateway            string             `bson:"gateway" json:"gateway"`
	DisplayName        string             `bson:"displayName" json:"displayName"`
	Credentials        map[string]string  `bson:"credentials" json:"-"`
	SandboxCredentials map[string]string  `bson:"sandboxCredentials" json:"-"`
	Sandbox            bool               `bson:"sandbox" json:"sandbox"`
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// GatewayConfigResponse is returned by the API (no credential values, only key names).
type GatewayConfigResponse struct {
	ID                    primitive.ObjectID `json:"id"`
	SellerID              string             `json:"sellerId"`
	Gateway               string             `json:"gateway"`
	DisplayName           string             `json:"displayName"`
	Sandbox               bool               `json:"sandbox"`
	CredentialKeys        []string           `json:"credentialKeys"`
	SandboxCredentialKeys []string           `json:"sandboxCredentialKeys"`
	CreatedAt             time.Time          `json:"createdAt"`
	UpdatedAt             time.Time          `json:"updatedAt"`
}

// PaymentSession tracks a redirect-based payment in progress.
type PaymentSession struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	QuoteID           string             `bson:"quoteId" json:"quoteId"`
	AccountID         string             `bson:"accountId" json:"accountId"`
	SellerID          string             `bson:"sellerId" json:"sellerId"`
	PaymentMethod     string             `bson:"paymentMethod" json:"paymentMethod"`
	DeliveryMethod    string             `bson:"deliveryMethod" json:"deliveryMethod"`
	PickupLocationID  string             `bson:"pickupLocationId,omitempty" json:"pickupLocationId,omitempty"`
	DeliveryAddressID string             `bson:"deliveryAddressId,omitempty" json:"deliveryAddressId,omitempty"`
	Amount            float64            `bson:"amount" json:"amount"`
	Currency          string             `bson:"currency" json:"currency"`
	ProviderSessionID string             `bson:"providerSessionId" json:"providerSessionId"`
	InvoiceRef        string             `bson:"invoiceRef,omitempty" json:"invoiceRef,omitempty"`
	RedirectURL       string             `bson:"redirectUrl" json:"redirectUrl"`
	ReturnURL         string             `bson:"returnUrl" json:"returnUrl"`
	Status            string             `bson:"status" json:"status"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	ExpiresAt         time.Time          `bson:"expiresAt" json:"expiresAt"`
}

// Registry maps gateway names to implementations.
type Registry struct {
	gateways map[string]Gateway
}

func NewRegistry() *Registry {
	return &Registry{gateways: make(map[string]Gateway)}
}

func (r *Registry) Register(name string, gw Gateway) {
	r.gateways[name] = gw
}

func (r *Registry) Get(name string) (Gateway, bool) {
	gw, ok := r.gateways[name]
	return gw, ok
}

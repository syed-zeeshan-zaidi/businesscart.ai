package auth

import (
	"business-cart/account-service/internal/storage"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// CustomerConfiguration represents the set of rules for a customer-company relationship in the JWT.
type CustomerConfiguration struct {
	CompanyID             string                       `json:"company_id"`
	DiscountPercentage    *float64                     `json:"discount,omitempty"`
	PaymentMethods        *[]storage.PaymentMethod     `json:"paymentMethods,omitempty"`
	DeliveryMethods       *[]storage.DeliveryMethod    `json:"deliveryMethods,omitempty"`
	ShippingOutOptions    *[]storage.ShippingOutOption `json:"shippingOutOptions,omitempty"`
	QuotesAllowed         *bool                        `json:"quotesAllowed,omitempty"`
	CouponsEnabled        *bool                        `json:"couponsEnabled,omitempty"`
	CreditLimit           *float64                     `json:"creditLimit,omitempty"`
	MinOrderAmountLimit   *float64                     `json:"minOrderAmountLimit,omitempty"`
	MaxOrderAmountLimit   *float64                     `json:"maxOrderAmountLimit,omitempty"`
	MinOrderQuantityLimit *float64                     `json:"minOrderQuantityLimit,omitempty"`
	MaxOrderQuantityLimit *float64                     `json:"maxOrderQuantityLimit,omitempty"`
	MonthlyOrderLimit     *float64                     `json:"monthlyOrderLimit,omitempty"`
	YearlyOrderLimit      *float64                     `json:"yearlyOrderLimit,omitempty"`
	TaxableGoods          *bool                        `json:"taxableGoods,omitempty"`
	TaxRate               *float64                     `json:"taxRate,omitempty"`
	ShippingRate          *float64                     `json:"shippingRate,omitempty"`
	LeadTime              *float64                     `json:"leadTime,omitempty"`
	GroupID               string                       `json:"groupID,omitempty"`
	GroupPriceDiscount    *float64                     `json:"groupPriceDiscount,omitempty"`
}

// OrgApproval is an organisation's own approval policy, carried once per token.
//
// Deliberately top-level rather than inside CustomerConfiguration. The policy
// belongs to the ORGANISATION, not to a supplier relationship, so copying it into
// every attached-company entry duplicated it N times and inflated a header that
// travels on every request. It also gives the SELLING side somewhere to live: a
// company account has no configurations array at all.
//
// Emitted for company and customer roles only. A RoleB2C storefront shopper is a
// person rather than an organisation and must never be gated — withholding this
// claim is the first of the two guards that guarantee it.
type OrgApproval struct {
	Scope             string                       `json:"scope,omitempty"`
	Threshold         *float64                     `json:"threshold,omitempty"`
	QuantityThreshold *float64                     `json:"quantityThreshold,omitempty"`
	ValidityHours     *float64                     `json:"validityHours,omitempty"`
	Chain             []storage.ApprovalStepConfig `json:"chain,omitempty"`
}

// UserClaims represents the user-specific data within the JWT.
type UserClaims struct {
	ID string `json:"id"`
	// The organisation this account acts within (Roadmap #21c). Equal to ID for
	// an account that is its own organisation, which is every account until a
	// parent is assigned — so consumers may compare against it unconditionally.
	OrgID string `json:"org_id,omitempty"`
	// Seniority inside that organisation (Roadmap #35g): owner, admin or user.
	// Consumers must treat an ABSENT claim as unrestricted, not as "user": it is
	// absent on platform-admin and storefront tokens, where restricting would be
	// wrong. Every org-capable token carries a value.
	OrgRole             string                  `json:"org_role,omitempty"`
	Email               string                  `json:"email"`
	Role                string                  `json:"role"`
	AssociateCompanyIDs []string                `json:"associate_company_ids"`
	Configurations      []CustomerConfiguration `json:"configurations,omitempty"`
	// The organisation's own approval policy — one copy, not one per supplier.
	OrgApproval *OrgApproval `json:"orgApproval,omitempty"`
}

// CustomClaims represents the full JWT payload.
type CustomClaims struct {
	User UserClaims `json:"user"`
	jwt.RegisteredClaims
}

func GenerateJWT(userID, orgID, orgRole, email, role, secret string, associateCompanyIDs []string, configs []CustomerConfiguration, orgApproval *OrgApproval) (string, error) {
	expirationTime := time.Now().Add(72 * time.Hour)

	claims := &CustomClaims{
		User: UserClaims{
			ID:                  userID,
			OrgID:               orgID,
			OrgRole:             orgRole,
			Email:               email,
			Role:                role,
			AssociateCompanyIDs: associateCompanyIDs,
			Configurations:      configs,
			OrgApproval:         orgApproval,
		},
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateJWT(tokenString, secret string) (*jwt.Token, error) {
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
}

func GenerateRefreshToken(userID, orgID, email, role, secret string, associateCompanyIDs []string) (string, error) {
	expirationTime := time.Now().Add(7 * 24 * time.Hour)

	claims := &CustomClaims{
		User: UserClaims{
			ID:                  userID,
			OrgID:               orgID,
			Email:               email,
			Role:                role,
			AssociateCompanyIDs: associateCompanyIDs,
			// Configurations are intentionally omitted for refresh token
		},
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

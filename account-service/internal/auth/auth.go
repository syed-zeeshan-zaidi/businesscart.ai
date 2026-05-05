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

// UserClaims represents the user-specific data within the JWT.
type UserClaims struct {
	ID                  string                  `json:"id"`
	Email               string                  `json:"email"`
	Role                string                  `json:"role"`
	AssociateCompanyIDs []string                `json:"associate_company_ids"`
	Configurations      []CustomerConfiguration `json:"configurations,omitempty"`
}

// CustomClaims represents the full JWT payload.
type CustomClaims struct {
	User UserClaims `json:"user"`
	jwt.RegisteredClaims
}

func GenerateJWT(userID, email, role, secret string, associateCompanyIDs []string, configs []CustomerConfiguration) (string, error) {
	expirationTime := time.Now().Add(72 * time.Hour)

	claims := &CustomClaims{
		User: UserClaims{
			ID:                  userID,
			Email:               email,
			Role:                role,
			AssociateCompanyIDs: associateCompanyIDs,
			Configurations:      configs,
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

func GenerateRefreshToken(userID, email, role, secret string, associateCompanyIDs []string) (string, error) {
	expirationTime := time.Now().Add(7 * 24 * time.Hour)

	claims := &CustomClaims{
		User: UserClaims{
			ID:                  userID,
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

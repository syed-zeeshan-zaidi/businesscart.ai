package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func GenerateJWT(userID, email, role, secret string, companyID string, associateCompanyIDs []string) (string, error) {
	claims := jwt.MapClaims{
		"user": map[string]interface{}{
			"id":                    userID,
			"role":                  role,
			"company_id":            companyID,
			"associate_company_ids": associateCompanyIDs,
		},
		"exp": time.Now().Add(time.Hour * 72).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateJWT(tokenString, secret string) (*jwt.Token, error) {
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
}

func GenerateRefreshToken(userID, email, role, secret, companyID string, associateCompanyIDs []string) (string, error) {
	claims := jwt.MapClaims{
		"user": map[string]interface{}{
			"id":                    userID,
			"role":                  role,
			"company_id":            companyID,
			"associate_company_ids": associateCompanyIDs,
		},
		"exp": time.Now().Add(time.Hour * 24 * 7).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

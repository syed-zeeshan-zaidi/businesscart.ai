package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try both "Authorization" and "authorization"
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				authHeader = r.Header.Get("authorization")
			}
			log.Printf("AuthMiddleware: Received Authorization header: %q", authHeader)

			if authHeader == "" {
				log.Printf("AuthMiddleware: No Authorization header found")
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			// Normalize header
			authHeader = strings.TrimSpace(authHeader)
			log.Printf("AuthMiddleware: Normalized Authorization header: %q", authHeader)

			// Check for Bearer prefix (case-insensitive)
			if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				log.Printf("AuthMiddleware: Invalid Authorization header format: %q", authHeader)
				http.Error(w, "Authorization header must start with 'Bearer '", http.StatusUnauthorized)
				return
			}

			// Extract token
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				tokenString = strings.TrimPrefix(authHeader, "Bearer")
			}
			if tokenString == authHeader {
				tokenString = strings.TrimPrefix(authHeader, "bearer ")
			}
			if tokenString == authHeader {
				tokenString = strings.TrimPrefix(authHeader, "bearer")
			}
			if tokenString == authHeader {
				log.Printf("AuthMiddleware: Failed to extract token from header: %q", authHeader)
				http.Error(w, "Invalid token format", http.StatusUnauthorized)
				return
			}
			log.Printf("AuthMiddleware: Extracted token: %q", tokenString)

			// Parse token
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Method.Alg())
				}
				return []byte(jwtSecret), nil
			})
			if err != nil {
				log.Printf("AuthMiddleware: Token parsing error: %v", err)
				http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
				return
			}

			if !token.Valid {
				log.Printf("AuthMiddleware: Token is not valid")
				http.Error(w, "Token is not valid", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				log.Printf("AuthMiddleware: Invalid token claims")
				http.Error(w, "Invalid token claims", http.StatusUnauthorized)
				return
			}

			user, ok := claims["user"].(map[string]interface{})
			if !ok {
				log.Printf("AuthMiddleware: Invalid user data in token")
				http.Error(w, "Invalid user data in token", http.StatusUnauthorized)
				return
			}

			log.Printf("AuthMiddleware: Successfully authenticated user: %v", user)
			ctx := context.WithValue(r.Context(), "user", user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

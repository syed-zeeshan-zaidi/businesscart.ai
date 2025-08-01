package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"business-cart/user-service/internal/auth"
	"business-cart/user-service/internal/storage"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	db               *storage.DB
	jwtSecret        string
	jwtRefreshSecret string
}

func NewHandler(db *storage.DB, jwtSecret, jwtRefreshSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret, jwtRefreshSecret: jwtRefreshSecret}
}

func (h *Handler) RegisterRoutes(router *chi.Mux) {
	router.Post("/users/register", h.RegisterUser)
	router.Post("/users/login", h.LoginUser)
	router.Post("/users/refresh", h.RefreshToken)
	router.Post("/users/logout", h.LogoutUser)

	// Protected routes
	router.Group(func(r chi.Router) {
		r.Use(h.AuthMiddleware)

		r.Get("/users", h.GetUsers)
		r.Post("/users/associate-company", h.AssociateCompany)

		r.Route("/users/{id}", func(r chi.Router) {
			r.Get("/", h.GetUserByID)
			r.Put("/", h.UpdateUser)
			r.Patch("/", h.PatchUser)
		})

		r.Group(func(r chi.Router) {
			r.Use(h.AdminMiddleware)

			r.Delete("/users/{id}", h.DeleteUser)
		})
	})
}

func (h *Handler) LogoutUser(w http.ResponseWriter, r *http.Request) {
	var reqBody struct {
		RefreshToken string `json:"refreshToken"`
		AccessToken  string `json:"accessToken"`
	}

	err := json.NewDecoder(r.Body).Decode(&reqBody)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Blacklist the access token
	blacklistedToken := &storage.BlacklistedToken{
		Token:     reqBody.AccessToken,
		ExpiresAt: primitive.NewDateTimeFromTime(time.Now().Add(time.Hour * 72)),
	}
	err = h.db.BlacklistToken(blacklistedToken)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete the refresh token
	err = h.db.DeleteRefreshToken(reqBody.RefreshToken)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) AssociateCompany(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value("claims").(jwt.MapClaims)
	userClaims, ok := claims["user"].(map[string]interface{})
	if !ok {
		http.Error(w, "Invalid token claims", http.StatusUnauthorized)
		return
	}
	userID, err := primitive.ObjectIDFromHex(userClaims["id"].(string))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var reqBody struct {
		CompanyID string `json:"companyId"`
	}

	err = json.NewDecoder(r.Body).Decode(&reqBody)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err = h.db.AssociateCompany(userID, reqBody.CompanyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch updated user details
	user, err := h.db.GetUserByID(userID)
	if err != nil {
		http.Error(w, "Failed to fetch user", http.StatusInternalServerError)
		return
	}

	// Generate new access token
	accessToken, err := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtSecret, user.CompanyID, user.AssociateCompanyIDs)
	if err != nil {
		http.Error(w, "Failed to generate access token", http.StatusInternalServerError)
		return
	}

	response := struct {
		AccessToken string `json:"accessToken"`
	}{accessToken}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	err = h.db.DeleteUser(objectID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) PatchUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Fetch the existing user
	user, err := h.db.GetUserByID(objectID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Decode the request body into a map
	var updates map[string]interface{}
	err = json.NewDecoder(r.Body).Decode(&updates)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Update the user fields based on the map
	if name, ok := updates["name"].(string); ok {
		user.Name = name
	}
	if email, ok := updates["email"].(string); ok {
		user.Email = email
	}
	if password, ok := updates["password"].(string); ok {
		hashedPassword, err := auth.HashPassword(password)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		user.Password = hashedPassword
	}
	if role, ok := updates["role"].(string); ok {
		user.Role = role
	}
	if companyID, ok := updates["company_id"].(string); ok {
		user.CompanyID = companyID
	}

	// Update the user in the database
	err = h.db.UpdateUser(objectID, user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var user storage.User
	err = json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err = h.db.UpdateUser(objectID, &user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) GetUserByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	user, err := h.db.GetUserByID(objectID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(user)
}

func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.db.GetUsers()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(users)
}

func (h *Handler) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenString := r.Header.Get("Authorization")
		if tokenString == "" {
			http.Error(w, "Missing authorization header", http.StatusUnauthorized)
			return
		}
		tokenString = strings.TrimPrefix(tokenString, "Bearer ")

		token, err := auth.ValidateJWT(tokenString, h.jwtSecret)
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok || !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Add claims to the context
		ctx := context.WithValue(r.Context(), "claims", claims)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *Handler) AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value("claims").(jwt.MapClaims)
		userClaims, ok := claims["user"].(map[string]interface{})
		if !ok {
			http.Error(w, "Invalid token claims", http.StatusUnauthorized)
			return
		}
		if userClaims["role"] != "admin" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var reqBody struct {
		RefreshToken string `json:"refreshToken"`
	}

	err := json.NewDecoder(r.Body).Decode(&reqBody)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	refreshToken, err := h.db.GetRefreshToken(reqBody.RefreshToken)
	if err != nil {
		http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
		return
	}

	// Check if the refresh token has expired
	if time.Now().After(refreshToken.ExpiresAt.Time()) {
		http.Error(w, "Refresh token expired", http.StatusUnauthorized)
		return
	}

	// Get the user associated with the refresh token
	user, err := h.db.GetUserByID(refreshToken.UserID)
	if err != nil {
		http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
		return
	}

	// Generate a new JWT
	token, err := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtSecret, user.CompanyID, user.AssociateCompanyIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate a new refresh token
	newRefreshToken, err := auth.GenerateRefreshToken(user.ID.Hex(), user.Email, user.Role, h.jwtRefreshSecret, user.CompanyID, user.AssociateCompanyIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Store new refresh token in the database
	err = h.db.CreateRefreshToken(&storage.RefreshToken{
		UserID:    user.ID,
		Token:     newRefreshToken,
		ExpiresAt: primitive.NewDateTimeFromTime(time.Now().Add(time.Hour * 24 * 7)),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete the old refresh token
	err = h.db.DeleteRefreshToken(reqBody.RefreshToken)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"accessToken":  token,
		"refreshToken": newRefreshToken,
	})
}

func (h *Handler) LoginUser(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&creds)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.db.GetUserByEmail(creds.Email)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if !auth.CheckPasswordHash(creds.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	accessToken, err := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtSecret, user.CompanyID, user.AssociateCompanyIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	refreshToken, err := h.generateAndStoreRefreshToken(user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
	})
}

type RegisterUserRequest struct {
	Name              string `json:"name"`
	Email             string `json:"email"`
	Password          string `json:"password"`
	Role              string `json:"role"`
	BusinessCode      string `json:"business_code,omitempty"`
	CompanyAccessCode string `json:"company_access_code,omitempty"`
	PhoneNumber       string `json:"phoneNumber,omitempty"`
}

func (h *Handler) RegisterUser(w http.ResponseWriter, r *http.Request) {
	var req RegisterUserRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user := &storage.User{
		Name:        req.Name,
		Email:       req.Email,
		Role:        req.Role,
		PhoneNumber: req.PhoneNumber,
	}

	if req.Role == "company" {
		if req.BusinessCode == "" {
			http.Error(w, "Missing business_code for company role", http.StatusBadRequest)
			return
		}
		businessCode, err := h.db.GetBusinessCode(req.BusinessCode)
		if err != nil {
			http.Error(w, "Invalid business_code", http.StatusBadRequest)
			return
		}
		user.CompanyID = businessCode.CompanyID
	} else if req.Role == "customer" {
		if req.CompanyAccessCode == "" {
			http.Error(w, "Missing company_access_code for customer role", http.StatusBadRequest)
			return
		}
		accessCode, err := h.db.GetCompanyAccessCode(req.CompanyAccessCode)
		if err != nil {
			http.Error(w, "Invalid company_access_code", http.StatusBadRequest)
			return
		}
		user.AssociateCompanyIDs = []string{accessCode.CompanyID}
	} else if req.Role != "admin" {
		http.Error(w, "Invalid role specified", http.StatusBadRequest)
		return
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	user.Password = hashedPassword

	err = h.db.CreateUser(user)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) generateAndStoreRefreshToken(user *storage.User) (string, error) {
	refreshToken, err := auth.GenerateRefreshToken(user.ID.Hex(), user.Email, user.Role, h.jwtRefreshSecret, user.CompanyID, user.AssociateCompanyIDs)
	if err != nil {
		return "", err
	}

	err = h.db.CreateRefreshToken(&storage.RefreshToken{
		UserID:    user.ID,
		Token:     refreshToken,
		ExpiresAt: primitive.NewDateTimeFromTime(time.Now().Add(time.Hour * 24 * 7)),
	})
	if err != nil {
		return "", err
	}

	return refreshToken, nil
}

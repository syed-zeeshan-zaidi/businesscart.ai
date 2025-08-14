package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"business-cart/account-service/internal/auth"
	"business-cart/account-service/internal/middleware"
	"business-cart/account-service/internal/storage"

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
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
	router.Post("/accounts/register", h.Register)
	router.Post("/accounts/login", h.Login)

	router.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(h.jwtSecret))
		r.Get("/accounts", h.GetAccounts)
		r.Get("/accounts/{id}", h.GetAccountByID)
		r.Patch("/accounts/{id}", h.UpdateAccount)
		r.Delete("/accounts/{id}", h.DeleteAccount)
		r.Post("/codes", h.CreateCode)    // admin only
		r.Get("/codes/{code}", h.GetCode) // admin only
	})
}

/* ---------- CODE ENDPOINTS ---------- */

type CreateCodeRequest struct {
	CompanyCode  string `json:"companyCode"`  // mandatory
	CustomerCode string `json:"customerCode"` // mandatory
	PartnerCode  string `json:"partnerCode"`  // optional
}

func (h *Handler) CreateCode(w http.ResponseWriter, r *http.Request) {
	// admin check
	if r.Context().Value("user").(map[string]interface{})["role"] != "admin" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	// duplicate check
	filter := bson.M{"$or": []bson.M{
		{"companyCode": req.CompanyCode},
		{"customerCode": req.CustomerCode},
	}}
	if req.PartnerCode != "" {
		filter["$or"] = append(filter["$or"].([]bson.M), bson.M{"partnerCode": req.PartnerCode})
	}

	count, err := h.db.CountCodes(filter)
	if err != nil {
		http.Error(w, "failed to check for existing codes", http.StatusInternalServerError)
		return
	}
	if count > 0 {
		http.Error(w, "code already exists", http.StatusConflict)
		return
	}

	codeDoc := &storage.Code{
		ID:           primitive.NewObjectID(),
		CompanyCode:  req.CompanyCode,
		CustomerCode: req.CustomerCode,
		PartnerCode:  req.PartnerCode,
		IsClaimed:    false,
		CreatedAt:    time.Now(),
	}
	if err := h.db.CreateCode(codeDoc); err != nil {
		http.Error(w, "failed to create code", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(codeDoc)
}

func (h *Handler) GetCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	doc, err := h.db.GetCode(bson.M{"$or": []bson.M{
		{"companyCode": code},
		{"customerCode": code},
		{"partnerCode": code},
	}})
	if err != nil {
		http.Error(w, "code not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(doc)
}

/* ---------- ACCOUNT ENDPOINTS ---------- */

/* ---------- REGISTER ---------- */

type RegisterRequest struct {
	Name          string   `json:"name"`
	Email         string   `json:"email"`
	Password      string   `json:"password"`
	Role          string   `json:"role"`          // customer | company | partner
	Code          string   `json:"code"`          // companyCode OR partnerCode OR ignored for customer
	CustomerCodes []string `json:"customerCodes"` // for customer role only
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	acc := &storage.Account{
		ID:            primitive.NewObjectID(),
		Name:          req.Name,
		Email:         req.Email,
		Password:      hashedPassword,
		Role:          req.Role,
		AccountStatus: storage.AccountActive,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	switch req.Role {
	// TODO: Remove this admin registration logic before production.
	case "admin":
		// No specific data needed for admin
	case "company":
		if req.Code == "" {
			http.Error(w, "companyCode required", http.StatusBadRequest)
			return
		}
		codeDoc, err := h.db.GetCode(bson.M{"companyCode": req.Code, "is_claimed": false})
		if err != nil {
			http.Error(w, "invalid or already-claimed company code", http.StatusBadRequest)
			return
		}

		// SAME Code ID and Account ID
		acc.ID = codeDoc.ID

		acc.CompanyData = &storage.CompanyData{
			CompanyCodeID: codeDoc.ID.Hex(),
			CompanyCode:   codeDoc.CompanyCode,
			Status:        "pending_setup",
		}
		_ = h.db.UpdateCode(codeDoc.ID, bson.M{"is_claimed": true})

	case "customer":
		if len(req.CustomerCodes) == 0 {
			http.Error(w, "at least one customerCode required", http.StatusBadRequest)
			return
		}
		var entries []storage.CustomerCodeEntry
		for _, cc := range req.CustomerCodes {
			codeDoc, err := h.db.GetCode(bson.M{"customerCode": cc})
			if err != nil {
				http.Error(w, "invalid customer code", http.StatusBadRequest)
				return
			}
			entries = append(entries, storage.CustomerCodeEntry{
				CodeID: codeDoc.ID.Hex(),
				Code:   codeDoc.CustomerCode,
			})
			// customer codes are **never** marked as claimed
		}
		acc.CustomerData = &storage.CustomerData{CustomerCodes: entries}

	case "partner":
		var partnerCode, partnerCodeID string
		if req.Code != "" {
			codeDoc, err := h.db.GetCode(bson.M{"partnerCode": req.Code, "is_claimed": false})
			if err != nil {
				http.Error(w, "invalid or already-claimed partner code", http.StatusBadRequest)
				return
			}
			partnerCode = codeDoc.PartnerCode
			partnerCodeID = codeDoc.ID.Hex()
			_ = h.db.UpdateCode(codeDoc.ID, bson.M{"is_claimed": true})
		}
		acc.PartnerData = &storage.PartnerData{
			PartnerCodeID: partnerCodeID,
			PartnerCode:   partnerCode,
			Status:        "pending",
		}

	default:
		http.Error(w, "invalid role", http.StatusBadRequest)
		return
	}

	if err := h.db.CreateAccount(acc); err != nil {
		http.Error(w, "failed to create account", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

/* ---------- LOGIN / REFRESH / LOGOUT ---------- */

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var creds LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	user, err := h.db.GetAccountByEmail(creds.Email)
	if err != nil || !auth.CheckPasswordHash(creds.Password, user.Password) {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	var associateCompanyIDs []string
	if user.Role == storage.RoleCustomer && user.CustomerData != nil {
		for _, codeEntry := range user.CustomerData.CustomerCodes {
			associateCompanyIDs = append(associateCompanyIDs, codeEntry.CodeID)
		}
	}

	accessToken, err := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtSecret, "", associateCompanyIDs)
	if err != nil {
		http.Error(w, "Failed to generate access token", http.StatusInternalServerError)
		return
	}

	refreshToken, err := h.generateAndStoreRefreshToken(user)
	if err != nil {
		http.Error(w, "Failed to generate refresh token", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
	})
}

func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	rt, err := h.db.GetRefreshToken(req.RefreshToken)
	if err != nil || time.Now().After(rt.ExpiresAt.Time()) {
		http.Error(w, "invalid or expired refresh token", http.StatusUnauthorized)
		return
	}

	user, _ := h.db.GetAccountByID(rt.UserID)
	var associateCompanyIDs []string
	if user.Role == storage.RoleCustomer && user.CustomerData != nil {
		for _, codeEntry := range user.CustomerData.CustomerCodes {
			associateCompanyIDs = append(associateCompanyIDs, codeEntry.CodeID)
		}
	}

	newAccess, _ := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtSecret, "", associateCompanyIDs)
	newRefresh, _ := h.generateAndStoreRefreshToken(user)

	_ = h.db.DeleteRefreshToken(req.RefreshToken)
	json.NewEncoder(w).Encode(map[string]string{"accessToken": newAccess, "refreshToken": newRefresh})
}

func (h *Handler) LogoutUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	_ = h.db.BlacklistToken(&storage.BlacklistedToken{Token: req.RefreshToken, ExpiresAt: primitive.NewDateTimeFromTime(time.Now().Add(72 * time.Hour))})
	_ = h.db.DeleteRefreshToken(req.RefreshToken)
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) generateAndStoreRefreshToken(user *storage.Account) (string, error) {
	var associateCompanyIDs []string
	if user.Role == storage.RoleCustomer && user.CustomerData != nil {
		for _, codeEntry := range user.CustomerData.CustomerCodes {
			associateCompanyIDs = append(associateCompanyIDs, codeEntry.CodeID)
		}
	}

	token, _ := auth.GenerateRefreshToken(user.ID.Hex(), user.Email, user.Role, h.jwtRefreshSecret, "", associateCompanyIDs)
	_ = h.db.CreateRefreshToken(&storage.RefreshToken{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: primitive.NewDateTimeFromTime(time.Now().Add(7 * 24 * time.Hour)),
	})
	return token, nil
}

/* ---------- OTHER CRUD ---------- */

func (h *Handler) GetAccountByID(w http.ResponseWriter, r *http.Request) {
	id, _ := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	acc, _ := h.db.GetAccountByID(id)
	json.NewEncoder(w).Encode(acc)
}

func (h *Handler) GetAccounts(w http.ResponseWriter, r *http.Request) {
	userClaims := r.Context().Value("user").(map[string]interface{})
	role := userClaims["role"].(string)
	userID := userClaims["id"].(string)

	var filter bson.M

	switch role {
	case storage.RoleAdmin:
		// Admin gets all accounts
		filter = bson.M{}
	case storage.RoleCompany:
		// Company gets their own account and their associated customer accounts
		userIDHex, err := primitive.ObjectIDFromHex(userID)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}
		filter = bson.M{
			"$or": []bson.M{
				{"_id": userIDHex},
				{"customer.customerCodes.codeId": userID},
			},
		}
	case storage.RoleCustomer, storage.RolePartner:
		// Customer and Partner get only their own account
		userIDHex, err := primitive.ObjectIDFromHex(userID)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}
		filter = bson.M{"_id": userIDHex}
	default:
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	accounts, err := h.db.GetAccounts(filter)
	if err != nil {
		http.Error(w, "Failed to retrieve accounts", http.StatusInternalServerError)
		return
	}

	// To prevent null response in JSON, return empty slice if no accounts found
	if len(accounts) == 0 {
		json.NewEncoder(w).Encode([]*storage.Account{})
		return
	}

	json.NewEncoder(w).Encode(accounts)
}

func (h *Handler) UpdateAccount(w http.ResponseWriter, r *http.Request) {
	id, _ := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	var upd map[string]interface{}
	json.NewDecoder(r.Body).Decode(&upd)
	_ = h.db.UpdateAccount(id, upd)
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	id, _ := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	_ = h.db.DeleteAccount(id)
	w.WriteHeader(http.StatusOK)
}

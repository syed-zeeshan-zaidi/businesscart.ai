package handler

import (
	"context"
	"encoding/json"
	"log"
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
	router.Use(middleware.CorsMiddleware)
	router.Post("/accounts/register", h.Register)
	router.Post("/accounts/login", h.Login)
	router.Post("/accounts/refresh", h.RefreshToken)
	router.Post("/accounts/logout", h.LogoutUser)

	router.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(h.jwtSecret))
		r.Get("/accounts", h.GetAccounts)
		r.Get("/accounts/{id}", h.GetAccountByID)
		r.Patch("/accounts/{id}", h.UpdateAccount)
		r.Put("/accounts/{id}", h.UpdateAccount) // Added PUT
		r.Delete("/accounts/{id}", h.DeleteAccount)
		r.Post("/codes", h.CreateCode)    // admin only
		r.Get("/codes", h.GetCodes)       // admin only
		r.Get("/codes/{code}", h.GetCode) // admin only

		// Customer configuration endpoint
		r.Patch("/customers/{customerId}/configuration", h.UpdateCustomerConfiguration) // company only
		r.Patch("/customers/{customerId}/associate", h.AssociateCustomerWithCompany)

		// Location endpoints
		r.Get("/accounts/locations/{accountID}", h.GetLocations)
		r.Post("/accounts/locations/{accountID}", h.UpsertLocation)
		r.Delete("/accounts/locations/{accountID}/{locationID}", h.DeleteLocation)
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

func (h *Handler) GetCodes(w http.ResponseWriter, r *http.Request) {
	// admin check
	if r.Context().Value("user").(map[string]interface{})["role"] != "admin" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	codes, err := h.db.GetCodes(bson.M{})
	if err != nil {
		http.Error(w, "failed to retrieve codes", http.StatusInternalServerError)
		return
	}

	if len(codes) == 0 {
		json.NewEncoder(w).Encode([]*storage.Code{})
		return
	}

	json.NewEncoder(w).Encode(codes)
}

type AssociateCustomerRequest struct {
	CustomerCode string `json:"customerCode"`
}

func (h *Handler) AssociateCustomerWithCompany(w http.ResponseWriter, r *http.Request) {
	// 1. Get customerId from URL
	customerIDStr := chi.URLParam(r, "customerId")
	customerID, err := primitive.ObjectIDFromHex(customerIDStr)
	if err != nil {
		http.Error(w, "Invalid customer ID", http.StatusBadRequest)
		return
	}

	// 2. Get user claims from JWT
	userClaims, ok := r.Context().Value("user").(map[string]interface{})
	if !ok {
		http.Error(w, "Invalid token claims", http.StatusUnauthorized)
		return
	}
	role, _ := userClaims["role"].(string)
	actorID, _ := userClaims["id"].(string)

	var entry *storage.CustomerCodeEntry

	// 3. Handle logic based on role
	switch role {
	case storage.RoleCustomer:
		// A customer can only associate themselves
		if actorID != customerIDStr {
			http.Error(w, "Forbidden: Customers can only associate their own account", http.StatusForbidden)
			return
		}

		var req AssociateCustomerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if req.CustomerCode == "" {
			http.Error(w, "customerCode is required", http.StatusBadRequest)
			return
		}

		codeDoc, err := h.db.GetCode(bson.M{"customerCode": req.CustomerCode})
		if err != nil {
			http.Error(w, "Invalid customer code", http.StatusBadRequest)
			return
		}
		entry = &storage.CustomerCodeEntry{
			CodeID: codeDoc.ID.Hex(),
			Code:   codeDoc.CustomerCode,
		}

	case storage.RoleCompany:
		companyID, err := primitive.ObjectIDFromHex(actorID)
		if err != nil {
			http.Error(w, "Invalid company ID in token", http.StatusInternalServerError)
			return
		}
		companyAccount, err := h.db.GetAccountByID(companyID)
		if err != nil || companyAccount.CompanyData == nil {
			http.Error(w, "Could not find company data", http.StatusNotFound)
			return
		}

		codeDoc, err := h.db.GetCode(bson.M{"companyCode": companyAccount.CompanyData.CompanyCode})
		if err != nil {
			http.Error(w, "Could not find associated customer code for company", http.StatusInternalServerError)
			return
		}
		entry = &storage.CustomerCodeEntry{
			CodeID: codeDoc.ID.Hex(),
			Code:   codeDoc.CustomerCode,
		}

	default:
		http.Error(w, "Forbidden: Invalid role for this action", http.StatusForbidden)
		return
	}

	// 4. Add the association to the customer's account
	if err := h.db.AddCustomerAssociation(customerID, entry); err != nil {
		log.Printf("Failed to add customer association: %v", err)
		http.Error(w, "Failed to update customer associations", http.StatusInternalServerError)
		return
	}

	// 5. Success
	w.WriteHeader(http.StatusOK)
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
		acc.CustomerData = &storage.CustomerData{CustomerConfigs: entries}

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
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second) // ≤ Lambda timeout
	defer cancel()

	user, err := h.db.GetAccountByEmail(creds.Email)
	if err != nil || !auth.CheckPasswordHash(creds.Password, user.Password) {
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	// ---- build claims in-memory (no second query) ----
	var assocIDs []string
	var configs []auth.CustomerConfiguration
	if user.Role == storage.RoleCustomer && user.CustomerData != nil {
		for _, e := range user.CustomerData.CustomerConfigs {
			assocIDs = append(assocIDs, e.CodeID)
			if e.Configuration != nil {
				configs = append(configs, auth.CustomerConfiguration{
					CompanyID:          e.CodeID,
					DiscountPercentage: e.Configuration.DiscountPercentage,
					PaymentMethods:     e.Configuration.PaymentMethods,
					DeliveryMethods:    e.Configuration.DeliveryMethods,
					ShippingOutOptions: e.Configuration.ShippingOutOptions,
					QuotesAllowed:      e.Configuration.QuotesAllowed,
				})
			}
		}
	}

	accessToken, err := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtSecret, assocIDs, configs)
	if err != nil {
		http.Error(w, `{"error":"token gen"}`, http.StatusInternalServerError)
		return
	}
	refreshToken, err := h.makeRefreshToken(ctx, user)
	if err != nil {
		http.Error(w, `{"error":"refresh token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
	})
}

// makeRefreshToken uses the already-loaded account – no extra DB call.
func (h *Handler) makeRefreshToken(ctx context.Context, user *storage.Account) (string, error) {
	var assoc []string
	if user.Role == storage.RoleCustomer && user.CustomerData != nil {
		for _, e := range user.CustomerData.CustomerConfigs {
			assoc = append(assoc, e.CodeID)
		}
	}
	tok, _ := auth.GenerateRefreshToken(user.ID.Hex(), user.Email, user.Role,
		h.jwtRefreshSecret, assoc)
	rt := &storage.RefreshToken{
		UserID:    user.ID,
		Token:     tok,
		ExpiresAt: primitive.NewDateTimeFromTime(time.Now().Add(7 * 24 * time.Hour)),
	}
	return tok, h.db.CreateRefreshToken(rt) // ← no ctx, no &
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
	var configs []auth.CustomerConfiguration
	if user.Role == storage.RoleCustomer && user.CustomerData != nil {
		for _, codeEntry := range user.CustomerData.CustomerConfigs {
			associateCompanyIDs = append(associateCompanyIDs, codeEntry.CodeID)
			if codeEntry.Configuration != nil {
				configs = append(configs, auth.CustomerConfiguration{
					CompanyID:          codeEntry.CodeID,
					DiscountPercentage: codeEntry.Configuration.DiscountPercentage,
					PaymentMethods:     codeEntry.Configuration.PaymentMethods,
					DeliveryMethods:    codeEntry.Configuration.DeliveryMethods,
					ShippingOutOptions: codeEntry.Configuration.ShippingOutOptions,
				})
			}
		}
	}

	newAccess, _ := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtRefreshSecret, associateCompanyIDs, configs)
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
		for _, codeEntry := range user.CustomerData.CustomerConfigs {
			associateCompanyIDs = append(associateCompanyIDs, codeEntry.CodeID)
		}
	}

	token, _ := auth.GenerateRefreshToken(user.ID.Hex(), user.Email, user.Role, h.jwtRefreshSecret, associateCompanyIDs)
	_ = h.db.CreateRefreshToken(&storage.RefreshToken{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: primitive.NewDateTimeFromTime(time.Now().Add(7 * 24 * time.Hour)),
	})
	return token, nil
}

/* ---------- OTHER CRUD ---------- */

func (h *Handler) GetAccountByID(w http.ResponseWriter, r *http.Request) {
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	acc, err := h.db.GetAccountByID(id)
	if err != nil {
		http.Error(w, "account not found", http.StatusNotFound)
		return
	}

	// attach full company data for customers, using the JWT for authorization
	userClaims := r.Context().Value("user").(map[string]interface{})
	if acc.Role == storage.RoleCustomer {
		if acc.CustomerData == nil {
			acc.CustomerData = &storage.CustomerData{}
		}

		// Fetch and attach customer addresses
		addresses, err := h.db.GetCustomerAddresses(bson.M{"customerId": acc.ID})
		if err != nil {
			log.Printf("Failed to get addresses for customer %s: %v", acc.ID.Hex(), err)
			acc.CustomerData.CustomerAddresses = []storage.CustomerAddress{}
		} else {
			plainAddresses := make([]storage.CustomerAddress, len(addresses))
			for i, addrPtr := range addresses {
				if addrPtr != nil {
					plainAddresses[i] = *addrPtr
				}
			}
			acc.CustomerData.CustomerAddresses = plainAddresses
		}

		if userClaims["associate_company_ids"] != nil {
			// We use the associate_company_ids from the JWT, not from the account document,
			// to ensure the caller is authorized to see this data.
			assocCompanyIDs, ok := userClaims["associate_company_ids"].([]interface{})
			if ok && len(assocCompanyIDs) > 0 {
				ids := make([]primitive.ObjectID, 0, len(assocCompanyIDs))
				for _, idInterface := range assocCompanyIDs {
					if idStr, ok := idInterface.(string); ok {
						if oid, err := primitive.ObjectIDFromHex(idStr); err == nil {
							ids = append(ids, oid)
						}
					}
				}

				companies, _ := h.db.GetAccountCompaniesDataByIDs(ids)
				attached := make([]storage.AttachedCompaniesData, 0, len(companies))
				for _, c := range companies {
					if c.CompanyData != nil {
						// For each company, fetch its locations
						locations, err := h.db.GetCompanyLocations(bson.M{"companyId": c.ID})
						if err != nil {
							log.Printf("Failed to get locations for company %s: %v", c.ID.Hex(), err)
							locations = []*storage.CompanyLocation{} // Ensure it's an empty slice, not nil
						}

						// Dereference the pointers to match the model
						plainLocations := make([]storage.CompanyLocation, len(locations))
						for i, locPtr := range locations {
							if locPtr != nil {
								plainLocations[i] = *locPtr
							}
						}

						attached = append(attached, storage.AttachedCompaniesData{
							Name:               c.CompanyData.Name,
							LogoURL:            c.CompanyData.LogoURL,
							CompanyCodeID:      c.CompanyData.CompanyCodeID,
							CompanyCode:        c.CompanyData.CompanyCode,
							SaleRepresentative: c.CompanyData.SaleRepresentative,
							Address:            c.CompanyData.Address,
							CreditLimit:        c.CompanyData.CreditLimit,
							QuotesAllowed:      c.CompanyData.QuotesAllowed,
							Status:             c.CompanyData.Status,
							ShippingOutOptions: c.CompanyData.ShippingOutOptions,
							PaymentMethods:     c.CompanyData.PaymentMethods,
							DeliveryMethods:    c.CompanyData.DeliveryMethods,
							CompanyLocations:   plainLocations,
						})
					}
				}
				acc.CustomerData.AttachedCompanies = attached
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
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
				{"customer.customerConfigs.codeId": userID},
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
	// ---------- 1.  authentication ----------
	raw := r.Context().Value("user")
	user, ok := raw.(map[string]interface{})
	if !ok {
		http.Error(w, "missing user context", http.StatusUnauthorized)
		return
	}
	role, ok1 := user["role"].(string)
	userID, ok2 := user["id"].(string)
	if !ok1 || !ok2 {
		http.Error(w, "invalid token claims", http.StatusUnauthorized)
		return
	}

	// ---------- 2.  target account ----------
	targetID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	// ---------- 3.  authorisation ----------
	switch role {
	case storage.RoleAdmin:
		// admin can update any account
	case storage.RoleCompany:
		if userID != targetID.Hex() {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	default:
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	// ---------- 4.  decode ----------
	var payload struct {
		Company map[string]interface{} `json:"company"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	// ---------- 5.  build $set (skip protected keys) ----------
	setFields := bson.M{}
	for k, v := range payload.Company {
		switch k {
		case "companyCode", "companyCodeId":
			continue // never overwrite
		default:
			setFields["company."+k] = v
		}
	}
	if len(setFields) == 0 {
		http.Error(w, "nothing to update", http.StatusBadRequest)
		return
	}

	// ---------- 6.  partial update ----------
	if err := h.db.UpdateAccount(targetID, setFields); err != nil {
		log.Printf("UpdateAccount error: %+v", err)
		http.Error(w, "update failed", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) UpdateCustomerConfiguration(w http.ResponseWriter, r *http.Request) {
	// 1. Get customerId from URL
	customerIDStr := chi.URLParam(r, "customerId")
	customerID, err := primitive.ObjectIDFromHex(customerIDStr)
	if err != nil {
		http.Error(w, "Invalid customer ID", http.StatusBadRequest)
		return
	}

	// 2. Get company from JWT
	userClaims, ok := r.Context().Value("user").(map[string]interface{})
	if !ok {
		http.Error(w, "Invalid token claims", http.StatusUnauthorized)
		return
	}

	role, _ := userClaims["role"].(string)
	companyID, _ := userClaims["id"].(string)

	// 3. Authorize: Must be a company
	if role != storage.RoleCompany {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// 4. Decode payload
	var config storage.CustomerConfiguration
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// 5. Call DB method to update the configuration for the specific customer-company link
	if err := h.db.UpdateCustomerConfiguration(customerID, companyID, &config); err != nil {
		log.Printf("Failed to update customer configuration: %v", err)
		http.Error(w, "Failed to update configuration", http.StatusInternalServerError)
		return
	}

	// 6. Success
	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	id, _ := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	_ = h.db.DeleteAccount(id)
	w.WriteHeader(http.StatusOK)
}

/* ---------- LOCATION ENDPOINTS ---------- */

func (h *Handler) GetLocations(w http.ResponseWriter, r *http.Request) {
	accountID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "accountID"))
	if err != nil {
		http.Error(w, "invalid accountID", http.StatusBadRequest)
		return
	}

	acc, err := h.db.GetAccountByID(accountID)
	if err != nil {
		http.Error(w, "account not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	userClaims := r.Context().Value("user").(map[string]interface{})
	authenticatedUserRole := userClaims["role"].(string)
	authenticatedUserID := userClaims["id"].(string)

	// Admins can view locations for any account
	if authenticatedUserRole == storage.RoleAdmin {
		switch acc.Role {
		case storage.RoleCompany:
			locations, err := h.db.GetCompanyLocations(bson.M{"companyId": accountID})
			if err != nil {
				http.Error(w, "failed to get company locations", http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(locations)
			return
		case storage.RoleCustomer:
			addresses, err := h.db.GetCustomerAddresses(bson.M{"customerId": accountID})
			if err != nil {
				http.Error(w, "failed to get customer addresses", http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(addresses)
			return
		default:
			http.Error(w, "target account role not supported for locations", http.StatusBadRequest)
			return
		}
	}

	// Company users can only view their own company locations
	if authenticatedUserRole == storage.RoleCompany && acc.Role == storage.RoleCompany && authenticatedUserID == accountID.Hex() {
		locations, err := h.db.GetCompanyLocations(bson.M{"companyId": accountID})
		if err != nil {
			http.Error(w, "failed to get company locations", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(locations)
		return
	}

	// Customer users can only view their own customer addresses
	if authenticatedUserRole == storage.RoleCustomer && acc.Role == storage.RoleCustomer && authenticatedUserID == accountID.Hex() {
		addresses, err := h.db.GetCustomerAddresses(bson.M{"customerId": accountID})
		if err != nil {
			http.Error(w, "failed to get customer addresses", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(addresses)
		return
	}

	http.Error(w, "Unauthorized to view locations for this account", http.StatusUnauthorized)
}

func (h *Handler) UpsertLocation(w http.ResponseWriter, r *http.Request) {
	accountID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "accountID"))
	if err != nil {
		http.Error(w, "invalid accountID", http.StatusBadRequest)
		return
	}

	acc, err := h.db.GetAccountByID(accountID)
	if err != nil {
		http.Error(w, "account not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	switch acc.Role {
	case storage.RoleCompany:
		var loc storage.CompanyLocation
		if err := json.NewDecoder(r.Body).Decode(&loc); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		loc.CompanyID = accountID

		// If an ID is provided, update the existing location
		if loc.ID != primitive.NilObjectID {
			loc.UpdatedAt = time.Now()
			if err := h.db.UpdateCompanyLocation(loc.ID, &loc); err != nil {
				http.Error(w, "failed to update company location", http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(loc)
			return
		}

		// Check for duplicates before creating
		existing, err := h.db.GetCompanyLocations(bson.M{
			"companyId":      accountID,
			"address.street": loc.Address.Street,
			"address.city":   loc.Address.City,
			"address.state":  loc.Address.State,
			"address.zip":    loc.Address.Zip,
		})
		if err == nil && len(existing) > 0 {
			json.NewEncoder(w).Encode(existing[0])
			return
		}

		loc.ID = primitive.NewObjectID()
		loc.CreatedAt = time.Now()
		loc.UpdatedAt = time.Now()
		if err := h.db.CreateCompanyLocation(&loc); err != nil {
			http.Error(w, "failed to create company location", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(loc)

	case storage.RoleCustomer:
		var addr storage.CustomerAddress
		if err := json.NewDecoder(r.Body).Decode(&addr); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		addr.CustomerID = accountID

		// If an ID is provided, update the existing address
		if addr.ID != primitive.NilObjectID {
			addr.UpdatedAt = time.Now()
			if err := h.db.UpdateCustomerAddress(addr.ID, &addr); err != nil {
				http.Error(w, "failed to update customer address", http.StatusInternalServerError)
				return
			}
			json.NewEncoder(w).Encode(addr)
			return
		}

		// Check for duplicates before creating
		existing, err := h.db.GetCustomerAddresses(bson.M{
			"customerId":     accountID,
			"address.street": addr.Address.Street,
			"address.city":   addr.Address.City,
			"address.state":  addr.Address.State,
			"address.zip":    addr.Address.Zip,
		})
		if err == nil && len(existing) > 0 {
			json.NewEncoder(w).Encode(existing[0])
			return
		}

		addr.ID = primitive.NewObjectID()
		addr.CreatedAt = time.Now()
		addr.UpdatedAt = time.Now()
		if err := h.db.CreateCustomerAddress(&addr); err != nil {
			http.Error(w, "failed to create customer address", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(addr)

	default:
		http.Error(w, "role not supported for locations", http.StatusBadRequest)
	}
}

func (h *Handler) DeleteLocation(w http.ResponseWriter, r *http.Request) {
	accountID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "accountID"))
	if err != nil {
		http.Error(w, "invalid accountID", http.StatusBadRequest)
		return
	}
	locationID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "locationID"))
	if err != nil {
		http.Error(w, "invalid locationID", http.StatusBadRequest)
		return
	}

	acc, err := h.db.GetAccountByID(accountID)
	if err != nil {
		http.Error(w, "account not found", http.StatusNotFound)
		return
	}

	// Authorization check: Ensure the authenticated user owns the account
	userClaims := r.Context().Value("user").(map[string]interface{})
	authenticatedUserID := userClaims["id"].(string)
	if authenticatedUserID != accountID.Hex() {
		http.Error(w, "Unauthorized", http.StatusForbidden)
		return
	}

	switch acc.Role {
	case storage.RoleCompany:
		if err := h.db.DeleteCompanyLocation(locationID); err != nil {
			http.Error(w, "failed to delete company location", http.StatusInternalServerError)
			return
		}
	case storage.RoleCustomer:
		if err := h.db.DeleteCustomerAddress(locationID); err != nil {
			http.Error(w, "failed to delete customer address", http.StatusInternalServerError)
			return
		}
	default:
		http.Error(w, "role not supported for locations", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

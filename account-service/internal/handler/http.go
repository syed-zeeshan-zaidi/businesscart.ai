package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode"

	"business-cart/account-service/internal/auth"
	"business-cart/account-service/internal/conversion"
	mailer "business-cart/account-service/internal/email"
	"business-cart/account-service/internal/generator"
	"business-cart/account-service/internal/storage"

	"context"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudfront"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// MaxCustomerGroups is the hard limit on customer groups per company.
// Frontend mirrors this constant — both sides validate without an API call.
const MaxCustomerGroups = 5

type LambdaHandler struct {
	db                *storage.DB
	jwtSecret         string
	jwtRefreshSecret  string
	d2cBucketName     string
	d2cDistributionId string
	emailSender       mailer.Sender
	requestOrigin     string // set per-request from Origin header
	conversions       *conversion.Service
	convCache         *conversion.ConfigCache
	convKey           []byte // dedicated AES key from CONVERSION_ENCRYPTION_KEY; nil = disabled
}

func NewLambdaHandler(db *storage.DB, jwtSecret, jwtRefreshSecret, d2cBucketName, d2cDistributionId, conversionEncryptionKey string, emailSender mailer.Sender) *LambdaHandler {
	// Server-side ad-conversion dispatcher, gated on a dedicated encryption key
	// (mirrors the payment gateway: GATEWAY_ENCRYPTION_KEY). If the key is unset
	// or malformed, conversion tracking is disabled — no JWT-derived fallback.
	var convKey []byte
	var conversions *conversion.Service
	if conversionEncryptionKey == "" {
		log.Println("WARNING: CONVERSION_ENCRYPTION_KEY not set. Ad-conversion tracking disabled.")
	} else if k, err := conversion.ParseKey(conversionEncryptionKey); err != nil {
		log.Printf("WARNING: CONVERSION_ENCRYPTION_KEY invalid, ad-conversion tracking disabled: %v", err)
	} else {
		convKey = k
		convRegistry := conversion.NewRegistry()
		convRegistry.Register(conversion.NewMetaDispatcher())
		conversions = conversion.NewService(convRegistry, convKey)
		log.Println("Ad-conversion tracking initialized.")
	}

	return &LambdaHandler{
		db:                db,
		jwtSecret:         jwtSecret,
		jwtRefreshSecret:  jwtRefreshSecret,
		d2cBucketName:     d2cBucketName,
		d2cDistributionId: d2cDistributionId,
		emailSender:       emailSender,
		conversions:       conversions,
		convKey:           convKey,
		// Warm-container cache of per-seller enabled creds; collapses the
		// per-event account read to ~one DB hit per seller per TTL.
		convCache: conversion.NewConfigCache(5 * time.Minute),
	}
}

func (h *LambdaHandler) HandleRequest(request events.APIGatewayProxyRequest) (resp events.APIGatewayProxyResponse, err error) {
	// Panic recover with admin alert. Without this, a panic kills the Lambda
	// invocation silently from the operator's perspective (just a 500 from API
	// Gateway with no signal). Email goes through the dedup'd NotifyAdmin so a
	// repeating panic does not flood the inbox.
	defer func() {
		if r := recover(); r != nil {
			// Subject keyed on Resource (bounded route template like
			// /accounts/{id}), not Path (contains unique IDs). Without this,
			// the dedup map grows once per unique URL and leaks memory over
			// Lambda container lifetime. Body keeps the actual path for debug.
			body := fmt.Sprintf("path=%s method=%s\npanic=%v", request.Path, request.HTTPMethod, r)
			mailer.NotifyAdmin(h.emailSender, "panic in account-service: "+request.Resource, body)
			log.Printf("PANIC in HandleRequest path=%s: %v", request.Path, r)
			resp = h.errorResponse(http.StatusInternalServerError, "Internal server error")
			err = nil
		}
	}()

	h.requestOrigin = request.Headers["origin"]
	if h.requestOrigin == "" {
		h.requestOrigin = request.Headers["Origin"]
	}

	if request.HTTPMethod == "OPTIONS" {
		return h.successResponse(nil, http.StatusOK), nil
	}

	// Public routes that do not require JWT authentication
	switch request.Path {
	case "/accounts/register":
		if request.HTTPMethod == "POST" {
			return h.register(request)
		}
	case "/accounts/login":
		if request.HTTPMethod == "POST" {
			return h.login(request)
		}
	case "/accounts/refresh":
		if request.HTTPMethod == "POST" {
			return h.refreshToken(request)
		}
	case "/accounts/logout":
		if request.HTTPMethod == "POST" {
			return h.logoutUser(request)
		}
	case "/accounts/forgot-password":
		if request.HTTPMethod == "POST" {
			return h.forgotPassword(request)
		}
	case "/accounts/reset-password":
		if request.HTTPMethod == "POST" {
			return h.resetPassword(request)
		}
	case "/visitors/event":
		if request.HTTPMethod == "POST" {
			return h.trackVisitorEvent(request)
		}
	}

	// Protected routes requiring JWT authentication
	authHeader, ok := request.Headers["Authorization"]
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: Missing token"), nil
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(h.jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: Invalid token"), nil
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: Invalid token claims"), nil
	}

	userClaim, ok := claims["user"].(map[string]interface{})
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: User claim is not a map"), nil
	}

	// --- Route protected requests ---
	if strings.HasPrefix(request.Path, "/accounts/locations") {
		return h.handleLocations(userClaim, request)
	}
	if strings.HasPrefix(request.Path, "/accounts") {
		return h.handleAccounts(userClaim, request)
	}
	if strings.HasPrefix(request.Path, "/codes") {
		return h.handleCodes(userClaim, request)
	}
	if strings.HasPrefix(request.Path, "/customers") {
		return h.handleCustomers(userClaim, request)
	}
	if strings.HasPrefix(request.Path, "/visitors") {
		return h.handleVisitors(userClaim, request)
	}

	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

// resolveFloat returns the customer override if set, else the company default (nil if zero).
func resolveFloat(companyDefault float64, customerOverride *float64) *float64 {
	if customerOverride != nil {
		return customerOverride
	}
	if companyDefault != 0 {
		return &companyDefault
	}
	return nil
}

// override safely extracts a *float64 field from a possibly-nil CustomerConfiguration.
func override(cfg *storage.CustomerConfiguration, getter func(*storage.CustomerConfiguration) *float64) *float64 {
	if cfg == nil {
		return nil
	}
	return getter(cfg)
}

func extractClaim(userClaim map[string]interface{}) (role, userID string, err error) {
	role, _ = userClaim["role"].(string)
	userID, _ = userClaim["id"].(string)
	if role == "" || userID == "" {
		return "", "", fmt.Errorf("invalid token claims")
	}
	return role, userID, nil
}

// --- Route Handlers ---

func (h *LambdaHandler) handleAccounts(userClaim map[string]interface{}, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// New logic to handle /accounts/{id}/regenerate
	pathParts := strings.Split(strings.Trim(request.Path, "/"), "/")
	if len(pathParts) == 3 && pathParts[0] == "accounts" && pathParts[2] == "regenerate" {
		if request.HTTPMethod == "POST" {
			id := pathParts[1]
			authHeader := request.Headers["Authorization"]
			jwtToken := ""
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				jwtToken = strings.TrimPrefix(authHeader, "Bearer ")
			}
			return h.regenerateStorefront(userClaim, id, jwtToken)
		}
	}
	if request.Path == "/accounts/export" && request.HTTPMethod == "GET" {
		return h.exportCustomers(userClaim)
	}
	if request.Path == "/accounts" && request.HTTPMethod == "GET" {
		return h.getAccounts(userClaim, request)
	}
	if id, ok := request.PathParameters["id"]; ok {
		switch request.HTTPMethod {
		case "GET":
			return h.getAccountByID(userClaim, id)
		case "PATCH", "PUT":
			authHeader := request.Headers["Authorization"]
			jwtToken := ""
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				jwtToken = strings.TrimPrefix(authHeader, "Bearer ")
			}
			return h.updateAccount(userClaim, id, request.Body, jwtToken)
		case "DELETE":
			return h.deleteAccount(userClaim, id)
		}
	}
	return h.errorResponse(http.StatusMethodNotAllowed, "Method not allowed"), nil
}

func (h *LambdaHandler) handleLocations(userClaim map[string]interface{}, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	parts := strings.Split(strings.Trim(request.Path, "/"), "/") // accounts/locations/{accountID}/{locationID}

	if len(parts) == 3 { // /accounts/locations/{accountID}
		accountID := parts[2]
		switch request.HTTPMethod {
		case "GET":
			return h.getLocations(userClaim, accountID)
		case "POST":
			return h.upsertLocation(userClaim, accountID, request.Body)
		}
	}
	if len(parts) == 4 { // /accounts/locations/{accountID}/{locationID}
		accountID := parts[2]
		locationID := parts[3]
		if request.HTTPMethod == "DELETE" {
			return h.deleteLocation(userClaim, accountID, locationID)
		}
	}
	return h.errorResponse(http.StatusMethodNotAllowed, "Method not allowed"), nil
}

func (h *LambdaHandler) handleCodes(userClaim map[string]interface{}, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if request.Path == "/codes" {
		switch request.HTTPMethod {
		case "GET":
			return h.getCodes(userClaim)
		case "POST":
			return h.createCode(userClaim, request.Body)
		}
	}
	if code, ok := request.PathParameters["code"]; ok {
		switch request.HTTPMethod {
		case "GET":
			return h.getCode(userClaim, code)
		case "DELETE":
			return h.deleteCode(userClaim, code)
		}
	}
	return h.errorResponse(http.StatusMethodNotAllowed, "Method not allowed"), nil
}

func (h *LambdaHandler) handleCustomers(userClaim map[string]interface{}, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	parts := strings.Split(strings.Trim(request.Path, "/"), "/") // customers/{customerId}/[configuration|associate]
	if len(parts) != 3 {
		return h.errorResponse(http.StatusNotFound, "Not found"), nil
	}
	customerID := parts[1]
	action := parts[2]

	if request.HTTPMethod == "PATCH" {
		if action == "configuration" {
			return h.updateCustomerConfiguration(userClaim, customerID, request.Body)
		}
		if action == "associate" {
			return h.associateCustomerWithCompany(userClaim, customerID, request.Body)
		}
	}
	return h.errorResponse(http.StatusMethodNotAllowed, "Method not allowed"), nil
}

// --- Handler Implementations ---

// NOTE: Implementations are based on original http.go, converted to Lambda format.

// --- Public Handlers ---

func (h *LambdaHandler) register(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var req storage.RegisterRequest
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	// Check for duplicate email
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" {
		return h.errorResponse(http.StatusBadRequest, "Email is required"), nil
	}
	if _, err := h.db.GetAccountByEmail(email); err == nil {
		return h.errorResponse(http.StatusConflict, "An account with this email already exists"), nil
	}

	// Validate password strength
	if err := validatePassword(req.Password); err != nil {
		return h.errorResponse(http.StatusBadRequest, err.Error()), nil
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to hash password"), nil
	}

	acc := &storage.Account{
		ID:            primitive.NewObjectID(),
		Name:          strings.TrimSpace(req.Name),
		Email:         email,
		PhoneNumber:   strings.TrimSpace(req.PhoneNumber),
		Password:      hashedPassword,
		Role:          req.Role,
		AccountStatus: storage.AccountActive,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Logic for roles from original handler
	switch req.Role {
	case "admin":
		// No specific data needed
	case "company":
		if req.Code == "" {
			return h.errorResponse(http.StatusBadRequest, "companyCode required"), nil
		}
		codeDoc, err := h.db.GetCode(bson.M{"companyCode": req.Code, "is_claimed": false})
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "invalid or already-claimed company code"), nil
		}
		acc.ID = codeDoc.ID
		acc.CompanyData = &storage.CompanyData{
			CompanyCodeID: codeDoc.ID.Hex(),
			CompanyCode:   codeDoc.CompanyCode,
			Status:        "pending_setup",
		}
		_ = h.db.UpdateCode(codeDoc.ID, bson.M{"is_claimed": true})

	case "customer":
		if len(req.CustomerCodes) == 0 {
			return h.errorResponse(http.StatusBadRequest, "at least one customerCode required"), nil
		}
		var entries []storage.CustomerCodeEntry
		for _, cc := range req.CustomerCodes {
			codeDoc, err := h.db.GetCode(bson.M{"customerCode": cc})
			if err != nil {
				return h.errorResponse(http.StatusBadRequest, "invalid customer code"), nil
			}
			entries = append(entries, storage.CustomerCodeEntry{
				CodeID: codeDoc.ID.Hex(),
				Code:   codeDoc.CustomerCode,
			})
		}
		acc.CustomerData = &storage.CustomerData{CustomerConfigs: entries}

	case "partner":
		if req.Code == "" {
			return h.errorResponse(http.StatusBadRequest, "partner invite code required"), nil
		}
		codeDoc, err := h.db.GetCode(bson.M{"partnerCode": req.Code})
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "invalid partner invite code"), nil
		}
		acc.PartnerData = &storage.PartnerData{
			Status:    "active",
			CompanyID: codeDoc.ID.Hex(),
		}
	case storage.RoleB2C:
		if req.Code == "" {
			return h.errorResponse(http.StatusBadRequest, "companyCode required for b2c registration"), nil
		}
		codeDoc, err := h.db.GetCode(bson.M{"companyCode": req.Code})
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "invalid company code for b2c registration"), nil
		}
		acc.CustomerData = &storage.CustomerData{
			CustomerConfigs: []storage.CustomerCodeEntry{
				{
					CodeID: codeDoc.ID.Hex(),
					Code:   codeDoc.CustomerCode,
				},
			},
		}

	default:
		return h.errorResponse(http.StatusBadRequest, "invalid role"), nil
	}

	if err := h.db.CreateAccount(acc); err != nil {
		log.Printf("Failed to create account: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "failed to create account"), nil
	}

	// Non-blocking welcome email — failure is logged but never blocks registration.
	// Customer-facing email uses the company's own SMTP (so the customer sees their
	// storefront brand, not BusinessCart). Falls back to platform sender for company /
	// partner registrations and when the company hasn't configured per-company SMTP.
	if h.emailSender != nil {
		sellerID := ""
		if acc.CustomerData != nil && len(acc.CustomerData.CustomerConfigs) > 0 {
			sellerID = acc.CustomerData.CustomerConfigs[0].CodeID
		}
		sender, _ := mailer.SenderForCompany(context.Background(), sellerID, h.emailSender)
		brandName, brandEmail := mailer.CompanyBrand(sellerID)
		go func(name, addr, bn, be string, s mailer.Sender) {
			if err := s.Send(context.Background(), mailer.WelcomeMessage(name, addr, bn, be)); err != nil {
				log.Printf("WARN: welcome email failed for %s: %v", addr, err)
			}
		}(acc.Name, acc.Email, brandName, brandEmail, sender)

		// Notify the company owner about the new customer (platform sender, BC SES).
		if sellerID != "" {
			if ownerEmail := mailer.CompanyOwnerEmail(sellerID); ownerEmail != "" {
				go func(to, customerName string) {
					if err := h.emailSender.Send(context.Background(), mailer.NewCustomerToCompanyMessage(to, customerName)); err != nil {
						log.Printf("WARN: new-customer notification failed for owner %s: %v", to, err)
					}
				}(ownerEmail, acc.Name)
			}
		}
	}

	return h.successResponse(acc, http.StatusCreated), nil
}

func (h *LambdaHandler) login(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var creds storage.LoginRequest
	if err := json.Unmarshal([]byte(request.Body), &creds); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid body"), nil
	}

	creds.Email = strings.TrimSpace(strings.ToLower(creds.Email))
	user, err := h.db.GetAccountByEmail(creds.Email)
	if err != nil || !auth.CheckPasswordHash(creds.Password, user.Password) {
		return h.errorResponse(http.StatusUnauthorized, "Invalid credentials"), nil
	}

	var assocIDs []string
	var configs []auth.CustomerConfiguration
	if (user.Role == storage.RoleCustomer || user.Role == storage.RoleB2C) && user.CustomerData != nil {
		for _, e := range user.CustomerData.CustomerConfigs {
			assocIDs = append(assocIDs, e.CodeID)
		}

		// Fetch associated company data to resolve enforcement defaults
		companyMap := make(map[string]*storage.CompanyData)
		if len(assocIDs) > 0 {
			companyIDs := make([]primitive.ObjectID, 0, len(assocIDs))
			for _, id := range assocIDs {
				if oid, err := primitive.ObjectIDFromHex(id); err == nil {
					companyIDs = append(companyIDs, oid)
				}
			}
			if companies, err := h.db.GetAccountCompaniesDataByIDs(companyIDs); err != nil {
				log.Printf("Warning: Failed to fetch company data for JWT enforcement: %v", err)
				// This is the exact site that 500'd uSetGo's admin GET /accounts on
				// 2026-05-05 (company.shippingRate stored as ""). Alert so the next
				// data-shape regression is caught in minutes, not customer complaints.
				mailer.NotifyAdmin(h.emailSender, "Failed to fetch company data", err.Error())
			} else {
				for _, c := range companies {
					if c.CompanyData != nil {
						companyMap[c.ID.Hex()] = c.CompanyData
					}
				}
			}
		}

		for _, e := range user.CustomerData.CustomerConfigs {
			config := auth.CustomerConfiguration{CompanyID: e.CodeID}

			// Existing 5 fields: customer override only (backward compatible)
			if e.Configuration != nil {
				config.DiscountPercentage = e.Configuration.DiscountPercentage
				config.PaymentMethods = e.Configuration.PaymentMethods
				config.DeliveryMethods = e.Configuration.DeliveryMethods
				config.ShippingOutOptions = e.Configuration.ShippingOutOptions
				config.QuotesAllowed = e.Configuration.QuotesAllowed
			}

			// New 8 float fields: resolved (company default + customer override)
			// TaxableGoods excluded — CompanyData uses plain bool, can't distinguish
			// "never set" (false) from "explicitly disabled" (false). Checkout defaults
			// to taxable when absent. Customer override still carried if set.
			company := companyMap[e.CodeID]
			if company != nil {
				config.CreditLimit = resolveFloat(company.CreditLimit, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.CreditLimit }))
				config.MinOrderAmountLimit = resolveFloat(company.MinOrderAmountLimit, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.MinOrderAmountLimit }))
				config.MaxOrderAmountLimit = resolveFloat(company.MaxOrderAmountLimit, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.MaxOrderAmountLimit }))
				config.MinOrderQuantityLimit = resolveFloat(company.MinOrderQuantityLimit, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.MinOrderQuantityLimit }))
				config.MaxOrderQuantityLimit = resolveFloat(company.MaxOrderQuantityLimit, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.MaxOrderQuantityLimit }))
				config.MonthlyOrderLimit = resolveFloat(company.MonthlyOrderLimit, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.MonthlyOrderLimit }))
				config.YearlyOrderLimit = resolveFloat(company.YearlyOrderLimit, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.YearlyOrderLimit }))
				config.LeadTime = resolveFloat(company.LeadTime, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.LeadTime }))
				config.TaxRate = resolveFloat(company.TaxRate, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.TaxRate }))
				config.ShippingRate = resolveFloat(company.ShippingRate, override(e.Configuration, func(c *storage.CustomerConfiguration) *float64 { return c.ShippingRate }))

				// Resolve customer's group → embed groupID + groupPriceDiscount.
				// Stale/missing group ID → silently no embed (falls back to base pricing).
				if e.GroupID != "" {
					for _, g := range company.CustomerGroups {
						if g.ID == e.GroupID {
							config.GroupID = e.GroupID
							if g.GroupPriceDiscount > 0 {
								d := g.GroupPriceDiscount
								config.GroupPriceDiscount = &d
							}
							break
						}
					}
				}
			}
			// TaxableGoods: customer override only (same as existing 5 fields)
			if e.Configuration != nil {
				config.TaxableGoods = e.Configuration.TaxableGoods
				config.CouponsEnabled = e.Configuration.CouponsEnabled
			}

			configs = append(configs, config)
		}
	}

	// Partner role: carry the linked company id in assocIDs so catalog/checkout
	// can use the existing associate_company_ids claim path without a new field.
	if user.Role == storage.RolePartner && user.PartnerData != nil && user.PartnerData.CompanyID != "" {
		assocIDs = append(assocIDs, user.PartnerData.CompanyID)
	}

	accessToken, err := auth.GenerateJWT(user.ID.Hex(), user.Email, user.Role, h.jwtSecret, assocIDs, configs)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Token generation failed"), nil
	}
	// Simplified refresh token logic for Lambda context
	refreshToken, _ := auth.GenerateRefreshToken(user.ID.Hex(), user.Email, user.Role, h.jwtRefreshSecret, assocIDs)

	// In a real app, you would store and manage the refresh token statefully

	response := map[string]string{
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
	}

	return h.successResponse(response, http.StatusOK), nil
}

func (h *LambdaHandler) refreshToken(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// This is a simplified version. A real implementation would require stateful refresh token validation.
	return h.errorResponse(http.StatusNotImplemented, "Refresh token functionality is not fully implemented in this version."), nil
}

func (h *LambdaHandler) logoutUser(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// In a stateless Lambda architecture, logout is primarily a client-side operation (deleting the token).
	// A stateful implementation would involve a token blacklist.
	return h.successResponse(map[string]string{"message": "Logged out"}, http.StatusOK), nil
}

func (h *LambdaHandler) forgotPassword(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" {
		return h.errorResponse(http.StatusBadRequest, "Email is required"), nil
	}

	// Always return success to prevent email enumeration
	successMsg := map[string]string{"message": "If an account with that email exists, a reset link has been sent."}

	acc, err := h.db.GetAccountByEmail(req.Email)
	if err != nil {
		return h.successResponse(successMsg, http.StatusOK), nil
	}

	// Generate 32-byte random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		log.Printf("WARN: failed to generate reset token: %v", err)
		return h.successResponse(successMsg, http.StatusOK), nil
	}
	token := hex.EncodeToString(tokenBytes)
	expiry := time.Now().Add(1 * time.Hour)

	// Store token + expiry on account
	if err := h.db.UpdateAccount(acc.ID, map[string]interface{}{
		"resetToken":       token,
		"resetTokenExpiry": expiry,
	}); err != nil {
		log.Printf("WARN: failed to save reset token for %s: %v", req.Email, err)
		return h.successResponse(successMsg, http.StatusOK), nil
	}

	// Determine reset URL based on request origin
	origin := h.requestOrigin
	if origin == "" {
		origin = "https://businesscart.ai"
	}
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", origin, token)

	// Non-blocking email — failure is logged but never blocks response.
	// Customer/b2c reset comes from the company's own SMTP (storefront brand);
	// company-role reset stays on the platform sender (admin context).
	if h.emailSender != nil {
		sellerID := ""
		if acc.CustomerData != nil && len(acc.CustomerData.CustomerConfigs) > 0 {
			sellerID = acc.CustomerData.CustomerConfigs[0].CodeID
		}
		sender, _ := mailer.SenderForCompany(context.Background(), sellerID, h.emailSender)
		brandName, brandEmail := mailer.CompanyBrand(sellerID)
		go func(name, addr, url, bn, be string, s mailer.Sender) {
			if err := s.Send(context.Background(), mailer.PasswordResetMessage(name, addr, url, bn, be)); err != nil {
				log.Printf("WARN: password reset email failed for %s: %v", addr, err)
			}
		}(acc.Name, acc.Email, resetURL, brandName, brandEmail, sender)
	}

	return h.successResponse(successMsg, http.StatusOK), nil
}

func (h *LambdaHandler) resetPassword(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}
	if req.Token == "" || req.Password == "" {
		return h.errorResponse(http.StatusBadRequest, "Token and password are required"), nil
	}

	// Validate password strength (same rules as registration)
	if len(req.Password) < 8 {
		return h.errorResponse(http.StatusBadRequest, "Password must be at least 8 characters"), nil
	}
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, c := range req.Password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsDigit(c):
			hasDigit = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}
	if !hasUpper || !hasLower || !hasDigit || !hasSpecial {
		return h.errorResponse(http.StatusBadRequest, "Password must contain uppercase, lowercase, digit, and special character"), nil
	}

	// Find account by reset token
	acc, err := h.db.GetAccountByResetToken(req.Token)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid or expired reset token"), nil
	}

	// Check expiry
	if acc.ResetTokenExpiry == nil || acc.ResetTokenExpiry.Before(time.Now()) {
		return h.errorResponse(http.StatusBadRequest, "Invalid or expired reset token"), nil
	}

	// Hash new password
	hashed, err := auth.HashPassword(req.Password)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to process password"), nil
	}

	// Update password and clear reset token
	if err := h.db.UpdateAccount(acc.ID,
		map[string]interface{}{"password": hashed},
		map[string]interface{}{"resetToken": "", "resetTokenExpiry": ""},
	); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to update password"), nil
	}

	return h.successResponse(map[string]string{"message": "Password has been reset successfully."}, http.StatusOK), nil
}

// --- Protected Handlers ---

func (h *LambdaHandler) getAccounts(userClaim map[string]interface{}, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	role, userID, err := extractClaim(userClaim)
	if err != nil {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}

	var filter bson.M
	switch role {
	case storage.RoleAdmin:
		filter = bson.M{}
	case storage.RoleCompany:
		userIDHex, _ := primitive.ObjectIDFromHex(userID)
		filter = bson.M{
			"$or": []bson.M{
				{"_id": userIDHex},
				{"customer.customerConfigs.codeId": userID},
			},
		}
	case storage.RoleCustomer, storage.RoleB2C, storage.RolePartner:
		userIDHex, _ := primitive.ObjectIDFromHex(userID)
		filter = bson.M{"_id": userIDHex}
	default:
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized"), nil
	}

	accounts, err := h.db.GetAccounts(filter)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to retrieve accounts"), nil
	}

	if len(accounts) == 0 {
		return h.successResponse([]*storage.Account{}, http.StatusOK), nil
	}

	return h.successResponse(accounts, http.StatusOK), nil
}

func (h *LambdaHandler) exportCustomers(userClaim map[string]interface{}) (events.APIGatewayProxyResponse, error) {
	role, userID, err := extractClaim(userClaim)
	if err != nil {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}
	if role != storage.RoleCompany && role != storage.RoleAdmin {
		return h.errorResponse(http.StatusForbidden, "Only company or admin can export"), nil
	}

	var filter bson.M
	if role == storage.RoleAdmin {
		filter = bson.M{"role": bson.M{"$in": []string{"customer", "b2c"}}}
	} else {
		filter = bson.M{"customer.customerConfigs.codeId": userID}
	}

	accounts, err := h.db.GetAccounts(filter)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to retrieve accounts"), nil
	}

	var b strings.Builder
	b.WriteString("Name,Email,Role,Created\n")
	for _, a := range accounts {
		created := ""
		if !a.CreatedAt.IsZero() {
			created = a.CreatedAt.Format("2006-01-02")
		}
		name := strings.ReplaceAll(a.Name, ",", " ")
		email := strings.ReplaceAll(a.Email, ",", " ")
		b.WriteString(fmt.Sprintf("%s,%s,%s,%s\n", name, email, a.Role, created))
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Content-Type":                "text/csv",
			"Content-Disposition":         "attachment; filename=customers.csv",
			"Access-Control-Allow-Origin": h.requestOrigin,
		},
		Body: b.String(),
	}, nil
}

// buildAdConversionSetFields encrypts each supplied ad-conversion credential and
// returns the Mongo $set entries keyed by a dotted per-field path
// (adConversions.<provider>.<field>). Using per-field paths means a partial
// update (e.g. rotating the access_token while leaving the pixel_id field blank)
// merges into the existing sub-document instead of replacing it and dropping the
// field the client did not resend — a whole-map $set on adConversions.<provider>
// would wipe it. Blank values are trimmed and skipped.
func (h *LambdaHandler) buildAdConversionSetFields(payload map[string]map[string]string) (map[string]interface{}, error) {
	out := make(map[string]interface{})
	for provider, creds := range payload {
		if !conversion.IsSupportedProvider(provider) {
			continue // ignore unknown providers rather than persisting junk keys
		}
		for field, val := range creds {
			val = strings.TrimSpace(val)
			if val == "" {
				continue
			}
			ct, err := conversion.Encrypt(h.convKey, val)
			if err != nil {
				return nil, err
			}
			out["adConversions."+provider+"."+field] = ct
		}
	}
	return out, nil
}

// buildAdConversionsInfo decrypts an account's stored ad-conversion creds in
// memory and populates the display-safe AdConversionsInfo (pixel_id shown
// fully — it is not secret; access_token masked to last-4). The raw token is
// never exposed. Mirrors the payment gateway's last-4 hint.
func (h *LambdaHandler) buildAdConversionsInfo(acc *storage.Account) {
	if acc == nil || len(acc.AdConversions) == 0 || len(h.convKey) == 0 {
		return
	}
	info := make(map[string]storage.AdConversionInfo, len(acc.AdConversions))
	for provider, creds := range acc.AdConversions {
		ci := storage.AdConversionInfo{Configured: true, Enabled: acc.AdConversionsEnabled[provider]}
		if enc, ok := creds["pixel_id"]; ok {
			if v, derr := conversion.Decrypt(h.convKey, enc); derr == nil {
				ci.PixelID = v
			}
		}
		if enc, ok := creds["access_token"]; ok {
			if v, derr := conversion.Decrypt(h.convKey, enc); derr == nil && len(v) >= 4 {
				ci.TokenLast4 = v[len(v)-4:]
			}
		}
		info[provider] = ci
	}
	acc.AdConversionsInfo = info
}

func (h *LambdaHandler) getAccountByID(userClaim map[string]interface{}, id string) (events.APIGatewayProxyResponse, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	// Authorization: An admin can get any account. Other roles can only get their own.
	if userClaim["role"] != storage.RoleAdmin && userClaim["id"] != id {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}

	acc, err := h.db.GetAccountByID(objID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Account not found"), nil
	}

	// Attach the masked, secret-free conversion-credential status for the admin UI.
	h.buildAdConversionsInfo(acc)

	// If the account is a customer, attach the full company data they are associated with.
	if acc.Role == storage.RoleCustomer || acc.Role == storage.RoleB2C {
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

		// Use the associate_company_ids from the JWT for authorization
		if assocCompanyIDs, ok := userClaim["associate_company_ids"].([]interface{}); ok && len(assocCompanyIDs) > 0 {
			var ids []primitive.ObjectID
			for _, idInterface := range assocCompanyIDs {
				if idStr, ok := idInterface.(string); ok {
					if oid, err := primitive.ObjectIDFromHex(idStr); err == nil {
						ids = append(ids, oid)
					}
				}
			}

			if len(ids) > 0 {
				companies, _ := h.db.GetAccountCompaniesDataByIDs(ids)
				attached := make([]storage.AttachedCompaniesData, 0, len(companies))
				for _, c := range companies {
					if c.CompanyData != nil {
						// For each company, fetch its locations
						locations, err := h.db.GetCompanyLocations(bson.M{"companyId": c.ID})
						if err != nil {
							log.Printf("Failed to get locations for company %s: %v", c.ID.Hex(), err)
							locations = []*storage.CompanyLocation{}
						}

						plainLocations := make([]storage.CompanyLocation, len(locations))
						for i, locPtr := range locations {
							if locPtr != nil {
								plainLocations[i] = *locPtr
							}
						}

						attached = append(attached, storage.AttachedCompaniesData{
							Name:                  c.CompanyData.Name,
							LogoURL:               c.CompanyData.LogoURL,
							CompanyCodeID:         c.CompanyData.CompanyCodeID,
							CompanyCode:           c.CompanyData.CompanyCode,
							SaleRepresentative:    c.CompanyData.SaleRepresentative,
							Address:               c.CompanyData.Address,
							CreditLimit:           c.CompanyData.CreditLimit,
							LeadTime:              c.CompanyData.LeadTime,
							MinOrderAmountLimit:   c.CompanyData.MinOrderAmountLimit,
							MaxOrderAmountLimit:   c.CompanyData.MaxOrderAmountLimit,
							MinOrderQuantityLimit: c.CompanyData.MinOrderQuantityLimit,
							MaxOrderQuantityLimit: c.CompanyData.MaxOrderQuantityLimit,
							MonthlyOrderLimit:     c.CompanyData.MonthlyOrderLimit,
							YearlyOrderLimit:      c.CompanyData.YearlyOrderLimit,
							TaxableGoods:          c.CompanyData.TaxableGoods,
							TaxRate:               c.CompanyData.TaxRate,
							ShippingRate:          c.CompanyData.ShippingRate,
							QuotesAllowed:         c.CompanyData.QuotesAllowed,
							CouponsEnabled:        c.CompanyData.CouponsEnabled,
							Status:                c.CompanyData.Status,
							ShippingOutOptions:    c.CompanyData.ShippingOutOptions,
							PaymentMethods:        c.CompanyData.PaymentMethods,
							DeliveryMethods:       c.CompanyData.DeliveryMethods,
							CompanyLocations:      plainLocations,
						})
					}
				}
				acc.CustomerData.AttachedCompanies = attached
			}
		}
	}

	// Surface the partner invite code on company reads. The Code row's _id equals
	// the company account _id (acc.ID = codeDoc.ID at company registration), so
	// this is a single primary-key lookup. Transient field, never persisted.
	if acc.Role == storage.RoleCompany && acc.CompanyData != nil {
		if codeDoc, err := h.db.GetCode(bson.M{"_id": acc.ID}); err == nil && codeDoc != nil {
			acc.CompanyData.PartnerCode = codeDoc.PartnerCode
		}
	}

	return h.successResponse(acc, http.StatusOK), nil
}

func (h *LambdaHandler) updateAccount(userClaim map[string]interface{}, id string, body string, jwtToken string) (events.APIGatewayProxyResponse, error) {
	// Implementation adapted from original UpdateAccount
	targetID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	// Authorization
	role, userID, err := extractClaim(userClaim)
	if err != nil {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}
	if role != storage.RoleAdmin && userID != targetID.Hex() {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}

	var payload struct {
		Company              map[string]interface{}       `json:"company"`
		AdConversions        map[string]map[string]string `json:"adConversions"`
		AdConversionsEnabled map[string]bool              `json:"adConversionsEnabled"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid body"), nil
	}

	// API-first contract: reject type mismatches at the boundary so the DB
	// never holds invalid state. Specifically guards against the frontend
	// sending "" for a cleared <input type=number>, which Go's BSON decoder
	// later rejects with "cannot decode string into a float64" → 500 on every
	// admin GET /accounts. See validateCompanyFieldTypes for the full rule.
	if err := validateCompanyFieldTypes(payload.Company); err != nil {
		return h.errorResponse(http.StatusBadRequest, err.Error()), nil
	}

	// Sanitize string fields that affect URLs and display
	for k, v := range payload.Company {
		if str, ok := v.(string); ok {
			if k == "name" || k == "contactEmail" || k == "contactPhone" {
				payload.Company[k] = strings.TrimSpace(str)
			}
		}
	}

	// Validate customerGroups (max MaxCustomerGroups, valid fields)
	if rawGroups, ok := payload.Company["customerGroups"]; ok && rawGroups != nil {
		groups, ok := rawGroups.([]interface{})
		if !ok {
			return h.errorResponse(http.StatusBadRequest, "customerGroups must be an array"), nil
		}
		if len(groups) > MaxCustomerGroups {
			return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("Maximum %d customer groups allowed per company", MaxCustomerGroups)), nil
		}
		seenIDs := make(map[string]bool)
		for i, g := range groups {
			gMap, ok := g.(map[string]interface{})
			if !ok {
				return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("customerGroups[%d] is not an object", i)), nil
			}
			id, _ := gMap["id"].(string)
			name, _ := gMap["name"].(string)
			id = strings.TrimSpace(id)
			name = strings.TrimSpace(name)
			if id == "" {
				return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("customerGroups[%d] missing id", i)), nil
			}
			if name == "" {
				return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("customerGroups[%d] missing name", i)), nil
			}
			if seenIDs[id] {
				return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("customerGroups: duplicate id %q", id)), nil
			}
			seenIDs[id] = true
			if discount, ok := gMap["groupPriceDiscount"].(float64); ok {
				if discount < 0 || discount > 100 {
					return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("customerGroups[%d] groupPriceDiscount must be 0-100", i)), nil
				}
			}
			gMap["id"] = id
			gMap["name"] = name
		}
	}

	setFields := bson.M{}
	unsetFields := bson.M{}
	for k, v := range payload.Company {
		// Only admin can change company codes
		if (k == "companyCode" || k == "companyCodeId") && role != storage.RoleAdmin {
			continue
		}

		// Only admin can toggle D2C enabled or change custom domain
		if k == "d2c" {
			if d2c, ok := v.(map[string]interface{}); ok {
				if role != storage.RoleAdmin {
					// Prevent changing these fields by removing them from the update payload
					delete(d2c, "enabled")
					delete(d2c, "customDomain")
					delete(d2c, "previewDomain")
				}
				// Sanitize D2C string fields
				for subK, subV := range d2c {
					if str, ok := subV.(string); ok {
						if subK == "contactEmail" || subK == "contactPhone" || subK == "heroTitle" || subK == "heroSlogan" || subK == "customDomain" {
							d2c[subK] = strings.TrimSpace(str)
						}
					}
				}
				// Flatten the d2c map into individual set operations to avoid overwriting the whole object
				for subK, subV := range d2c {
					setFields["company.d2c."+subK] = subV
				}
				continue
			}
		}

		// Storage rule: empty array → unset (don't store empty arrays)
		if k == "customerGroups" {
			if arr, ok := v.([]interface{}); ok && len(arr) == 0 {
				unsetFields["company.customerGroups"] = ""
				continue
			}
		}

		setFields["company."+k] = v
	}

	// Ad-platform conversion credentials (Meta pixel_id + access_token; Google
	// later). Encrypt each value server-side before storing so the raw token
	// never lands in the DB. Rides this existing endpoint (no new route) and is
	// never returned (Account.AdConversions is json:"-"). Mirrors the payment
	// gateway credential-handling contract.
	if len(payload.AdConversions) > 0 {
		if len(h.convKey) == 0 {
			return h.errorResponse(http.StatusServiceUnavailable, "Ad-conversion tracking is not configured on this environment"), nil
		}
		encFields, encErr := h.buildAdConversionSetFields(payload.AdConversions)
		if encErr != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to secure credentials"), nil
		}
		for k, v := range encFields {
			setFields[k] = v
		}
	}
	// Per-provider enable/disable switch (not a secret; stored plainly).
	for provider, enabled := range payload.AdConversionsEnabled {
		if !conversion.IsSupportedProvider(provider) {
			continue
		}
		setFields["adConversionsEnabled."+provider] = enabled
	}

	if len(setFields) == 0 && len(unsetFields) == 0 {
		return h.errorResponse(http.StatusBadRequest, "Nothing to update"), nil
	}

	if err := h.db.UpdateAccount(targetID, setFields, unsetFields); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Update failed"), nil
	}

	// A conversion-config change invalidates this seller's cached creds so the
	// change takes effect on this container immediately (others refresh by TTL).
	if h.convCache != nil && (len(payload.AdConversions) > 0 || len(payload.AdConversionsEnabled) > 0) {
		h.convCache.Invalidate(targetID.Hex())
	}

	// Trigger D2C generation if enabled (this will also generate PreviewDomain if
	// missing). A conversion-only change (no company/storefront fields) doesn't
	// affect the generated storefront, so skip the expensive regen + S3 upload and
	// its misleading 500. Any company/D2C edit still regenerates as before.
	conversionOnly := len(payload.Company) == 0 &&
		(len(payload.AdConversions) > 0 || len(payload.AdConversionsEnabled) > 0)
	if !conversionOnly {
		if err := h.triggerD2CGeneration(targetID, jwtToken); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Storefront generation failed: "+err.Error()), nil
		}
	}

	// Return the updated account to the frontend so it sees the generated PreviewDomain
	updatedAcc, err := h.db.GetAccountByID(targetID)
	if err != nil {
		return h.successResponse(nil, http.StatusOK), nil
	}
	h.buildAdConversionsInfo(updatedAcc)

	return h.successResponse(updatedAcc, http.StatusOK), nil
}

func (h *LambdaHandler) regenerateStorefront(userClaim map[string]interface{}, id string, jwtToken string) (events.APIGatewayProxyResponse, error) {
	targetID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	// Authorization - Admin or the company itself
	role, userID, err := extractClaim(userClaim)
	if err != nil {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}
	if role != storage.RoleAdmin && userID != targetID.Hex() {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}

	// Trigger generation synchronously
	if err := h.triggerD2CGeneration(targetID, jwtToken); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Storefront generation failed: "+err.Error()), nil
	}

	return h.successResponse(map[string]string{"message": "Storefront generation has completed."}, http.StatusOK), nil
}

func (h *LambdaHandler) triggerD2CGeneration(accountID primitive.ObjectID, jwtToken string) error {
	acc, err := h.db.GetAccountByID(accountID)
	if err != nil || acc.CompanyData == nil || acc.CompanyData.D2C == nil {
		log.Printf("D2C Generation Skip: account or D2C config not found for %s", accountID.Hex())
		return nil
	}

	// 1. Initialize Generator and S3 Client (needed for both Enable and Disable)
	cfg, err := config.LoadDefaultConfig(context.TODO())
	var s3Client *s3.Client
	var cfClient *cloudfront.Client
	if err == nil {
		s3Client = s3.NewFromConfig(cfg)
		cfClient = cloudfront.NewFromConfig(cfg)
	} else {
		log.Printf("Warning: Failed to load AWS config: %v", err)
	}

	tmplDir := os.Getenv("D2C_TEMPLATE_DIR")
	outputDir := os.Getenv("D2C_OUTPUT_DIR")
	if outputDir == "" {
		outputDir = "/tmp/storefronts"
	}

	gen := generator.NewGenerator(tmplDir, outputDir, s3Client, h.d2cBucketName, cfClient, h.d2cDistributionId)

	// 2. Handle Case: Storefront Disabled (Offboarding)
	if !acc.CompanyData.D2C.Enabled {
		log.Printf("D2C Storefront disabled for %s. Cleaning up S3 assets...", acc.CompanyData.Name)
		if err := gen.DeleteStorefront(acc.CompanyData.UniqueIdentifier); err != nil {
			log.Printf("ERROR: Failed to delete storefront assets for %s: %v", acc.ID.Hex(), err)
		}
		return nil
	}

	log.Printf("D2C Storefront generating for %s...", acc.CompanyData.Name)

	// 3. Ensure PreviewDomain is set (Source of truth)
	if acc.CompanyData.D2C.PreviewDomain == "" {
		prefix := acc.CompanyData.UniqueIdentifier
		if prefix == "" {
			prefix = acc.ID.Hex()
		}
		acc.CompanyData.D2C.PreviewDomain = prefix + ".businesscart.ai"
		_ = h.db.UpdateAccount(acc.ID, bson.M{"company.d2c.previewDomain": acc.CompanyData.D2C.PreviewDomain})
	}

	// 4. Fetch Products (only active products for storefront)
	allProducts := h.fetchCompanyProducts(acc.ID.Hex(), jwtToken)
	var products []generator.ProductData
	for _, p := range allProducts {
		if p.Active == nil || *p.Active {
			products = append(products, p)
		}
	}

	// 4b. Fetch Blog Posts (isolated — silent fail; never blocks storefront)
	allBlogPosts := h.fetchCompanyBlogPosts(acc.ID.Hex(), jwtToken)
	var blogPosts []generator.BlogPostData
	for _, p := range allBlogPosts {
		if p.Active == nil || *p.Active {
			blogPosts = append(blogPosts, p)
		}
	}

	// 5. Run Generator
	genData := generator.StorefrontData{
		AccountID: acc.ID.Hex(),
		Company:   acc.CompanyData,
		Config:    acc.CompanyData.D2C,
		Products:  products,
		BlogPosts: blogPosts,
		ApiBase:   os.Getenv("API_BASE_URL"),
	}

	if err := gen.Generate(genData); err != nil {
		log.Printf("D2C Generation Failed for %s: %v", acc.ID.Hex(), err)
		return err
	}

	// Invalidate CloudFront cache for this company only
	if err := gen.InvalidateCache(acc.CompanyData.UniqueIdentifier); err != nil {
		log.Printf("CloudFront invalidation warning for %s: %v", acc.CompanyData.Name, err)
		// Don't return error — generation succeeded, invalidation is best-effort
	}

	log.Printf("D2C Storefront successfully generated for %s at https://%s", acc.CompanyData.Name, acc.CompanyData.D2C.PreviewDomain)
	return nil
}

func (h *LambdaHandler) fetchCompanyProducts(companyID string, jwtToken string) []generator.ProductData {
	log.Printf("Fetching products for companyID: %s using provided JWT", companyID)

	catalogServiceURL := os.Getenv("CATALOG_SERVICE_URL")
	if catalogServiceURL == "" {
		log.Println("CATALOG_SERVICE_URL environment variable not set. Returning empty product list.")
		return []generator.ProductData{}
	}

	productsURL := fmt.Sprintf("%s/products", catalogServiceURL)
	log.Printf("DEBUG: Catalog Service URL: %s", catalogServiceURL)
	log.Printf("DEBUG: Products Endpoint URL: %s", productsURL)
	log.Printf("DEBUG: JWT Token Length: %d", len(jwtToken))

	req, err := http.NewRequest("GET", productsURL, nil)
	if err != nil {
		log.Printf("Failed to create HTTP request to catalog-service for companyID %s: %v", companyID, err)
		return []generator.ProductData{}
	}

	req.Header.Add("Authorization", "Bearer "+jwtToken)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to make HTTP request to catalog-service for companyID %s: %v", companyID, err)
		return []generator.ProductData{}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("Catalog-service returned non-OK status for companyID %s: %d - %s", companyID, resp.StatusCode, string(bodyBytes))
		return []generator.ProductData{}
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read response body from catalog-service for companyID %s: %v", companyID, err)
		return []generator.ProductData{}
	}

	var products []generator.ProductData
	if err := json.Unmarshal(bodyBytes, &products); err != nil {
		log.Printf("Failed to unmarshal products from catalog-service response for companyID %s: %v", companyID, err)
		return []generator.ProductData{}
	}

	log.Printf("Successfully fetched %d products for companyID %s from catalog-service", len(products), companyID)

	// Calculate DiscountedPrice if DealPrice exists (DealPrice is a percentage 0-50)
	for i := range products {
		if products[i].DealPrice > 0 {
			products[i].DiscountedPrice = products[i].Price * (1 - products[i].DealPrice/100)
		}
	}

	return products
}

// fetchCompanyBlogPosts is the isolated blog fetch — mirrors fetchCompanyProducts.
// Silent-fail returns empty slice on any error so a catalog-service outage or
// pre-blog-deploy state never blocks storefront regeneration.
func (h *LambdaHandler) fetchCompanyBlogPosts(companyID string, jwtToken string) []generator.BlogPostData {
	catalogServiceURL := os.Getenv("CATALOG_SERVICE_URL")
	if catalogServiceURL == "" {
		return []generator.BlogPostData{}
	}

	url := fmt.Sprintf("%s/blog", catalogServiceURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Printf("[blog-fetch] new request error: %v", err)
		return []generator.BlogPostData{}
	}
	req.Header.Add("Authorization", "Bearer "+jwtToken)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[blog-fetch] request error for companyID %s: %v", companyID, err)
		return []generator.BlogPostData{}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Could be 404 if route not deployed yet — silent skip
		return []generator.BlogPostData{}
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return []generator.BlogPostData{}
	}

	var posts []generator.BlogPostData
	if err := json.Unmarshal(bodyBytes, &posts); err != nil {
		log.Printf("[blog-fetch] unmarshal error: %v", err)
		return []generator.BlogPostData{}
	}

	log.Printf("[blog-fetch] fetched %d posts for companyID %s", len(posts), companyID)
	return posts
}

func (h *LambdaHandler) deleteAccount(userClaim map[string]interface{}, id string) (events.APIGatewayProxyResponse, error) {
	// Authorization: simple admin check
	if userClaim["role"] != storage.RoleAdmin {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}
	objID, _ := primitive.ObjectIDFromHex(id)
	acc, _ := h.db.GetAccountByID(objID)
	_ = h.db.DeleteAccount(objID)
	if acc != nil && acc.Role == storage.RoleCompany {
		_ = h.db.DeleteCode(objID) // cascade: Code._id == company.account._id by design
	}
	return h.successResponse(nil, http.StatusNoContent), nil
}

func (h *LambdaHandler) createCode(userClaim map[string]interface{}, body string) (events.APIGatewayProxyResponse, error) {
	if userClaim["role"] != "admin" {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized"), nil
	}
	var req storage.CreateCodeRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid body"), nil
	}
	if req.CompanyCode == "" {
		return h.errorResponse(http.StatusBadRequest, "companyCode required"), nil
	}

	// Upsert by companyCode. If a row already exists, the request is an edit:
	// only partnerCode is mutable; companyCode and customerCode are locked
	// because companyCode is tied to the company account _id at registration.
	if existing, err := h.db.GetCode(bson.M{"companyCode": req.CompanyCode}); err == nil && existing != nil {
		if err := h.db.UpdateCode(existing.ID, bson.M{"partnerCode": req.PartnerCode}); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "failed to update code"), nil
		}
		doc, _ := h.db.GetCode(bson.M{"_id": existing.ID})
		return h.successResponse(doc, http.StatusOK), nil
	}

	// Create mode: existing behavior unchanged.
	codeDoc := &storage.Code{
		ID:           primitive.NewObjectID(),
		CompanyCode:  req.CompanyCode,
		CustomerCode: req.CustomerCode,
		PartnerCode:  req.PartnerCode,
		IsClaimed:    false,
		CreatedAt:    time.Now(),
	}
	if err := h.db.CreateCode(codeDoc); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "failed to create code"), nil
	}
	return h.successResponse(codeDoc, http.StatusCreated), nil
}

func (h *LambdaHandler) getCode(userClaim map[string]interface{}, code string) (events.APIGatewayProxyResponse, error) {
	if userClaim["role"] != "admin" {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized"), nil
	}
	doc, err := h.db.GetCode(bson.M{"$or": []bson.M{
		{"companyCode": code},
		{"customerCode": code},
		{"partnerCode": code},
	}})
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "code not found"), nil
	}
	return h.successResponse(doc, http.StatusOK), nil
}

func (h *LambdaHandler) deleteCode(userClaim map[string]interface{}, code string) (events.APIGatewayProxyResponse, error) {
	if userClaim["role"] != storage.RoleAdmin {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}
	doc, err := h.db.GetCode(bson.M{"$or": []bson.M{
		{"companyCode": code},
		{"customerCode": code},
		{"partnerCode": code},
	}})
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "code not found"), nil
	}
	if doc.IsClaimed {
		return h.errorResponse(http.StatusConflict, "code is claimed; delete the account first"), nil
	}
	if err := h.db.DeleteCode(doc.ID); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "failed to delete code"), nil
	}
	return h.successResponse(nil, http.StatusNoContent), nil
}

func (h *LambdaHandler) getCodes(userClaim map[string]interface{}) (events.APIGatewayProxyResponse, error) {
	if userClaim["role"] != "admin" {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized"), nil
	}
	codes, err := h.db.GetCodes(bson.M{})
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "failed to retrieve codes"), nil
	}
	if len(codes) == 0 {
		return h.successResponse([]*storage.Code{}, http.StatusOK), nil
	}
	return h.successResponse(codes, http.StatusOK), nil
}

func (h *LambdaHandler) updateCustomerConfiguration(userClaim map[string]interface{}, customerIDStr string, body string) (events.APIGatewayProxyResponse, error) {
	if userClaim["role"] != storage.RoleCompany {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}
	customerID, err := primitive.ObjectIDFromHex(customerIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid customer ID"), nil
	}
	companyID, _ := userClaim["id"].(string)
	if companyID == "" {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}

	// Parse raw body to handle both config fields and groupID together
	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(body), &raw); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	// Re-marshal/unmarshal into typed CustomerConfiguration so existing fields populate
	var config storage.CustomerConfiguration
	if cfgBytes, err := json.Marshal(raw); err == nil {
		_ = json.Unmarshal(cfgBytes, &config)
	}

	// Parse and validate groupID (if present in request)
	var groupIDPtr *string
	if rawGID, exists := raw["groupID"]; exists {
		gidStr, _ := rawGID.(string)
		gidStr = strings.TrimSpace(gidStr)
		if gidStr != "" {
			// Validate the group exists in this company
			companyOID, err := primitive.ObjectIDFromHex(companyID)
			if err != nil {
				return h.errorResponse(http.StatusBadRequest, "Invalid company ID in token"), nil
			}
			companyAcc, err := h.db.GetAccountByID(companyOID)
			if err != nil || companyAcc.CompanyData == nil {
				return h.errorResponse(http.StatusNotFound, "Company not found"), nil
			}
			found := false
			for _, g := range companyAcc.CompanyData.CustomerGroups {
				if g.ID == gidStr {
					found = true
					break
				}
			}
			if !found {
				return h.errorResponse(http.StatusBadRequest, "groupID does not exist in company's customer groups"), nil
			}
		}
		groupIDPtr = &gidStr
	}

	if err := h.db.UpdateCustomerConfiguration(customerID, companyID, &config, groupIDPtr); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to update configuration"), nil
	}
	return h.successResponse(nil, http.StatusOK), nil
}

func (h *LambdaHandler) associateCustomerWithCompany(userClaim map[string]interface{}, customerIDStr string, body string) (events.APIGatewayProxyResponse, error) {
	customerID, err := primitive.ObjectIDFromHex(customerIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid customer ID"), nil
	}

	role, actorID, err := extractClaim(userClaim)
	if err != nil {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}

	var entry *storage.CustomerCodeEntry

	switch role {
	case storage.RoleCustomer, storage.RoleB2C:
		if actorID != customerIDStr {
			return h.errorResponse(http.StatusForbidden, "Forbidden: Customers can only associate their own account"), nil
		}
		var req storage.AssociateCustomerRequest
		if err := json.Unmarshal([]byte(body), &req); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
		}
		if req.CustomerCode == "" {
			return h.errorResponse(http.StatusBadRequest, "customerCode is required"), nil
		}
		codeDoc, err := h.db.GetCode(bson.M{"customerCode": req.CustomerCode})
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid customer code"), nil
		}
		entry = &storage.CustomerCodeEntry{CodeID: codeDoc.ID.Hex(), Code: codeDoc.CustomerCode}

	case storage.RoleCompany:
		companyID, _ := primitive.ObjectIDFromHex(actorID)
		companyAccount, err := h.db.GetAccountByID(companyID)
		if err != nil || companyAccount.CompanyData == nil {
			return h.errorResponse(http.StatusNotFound, "Could not find company data"), nil
		}
		codeDoc, err := h.db.GetCode(bson.M{"companyCode": companyAccount.CompanyData.CompanyCode})
		if err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Could not find associated customer code for company"), nil
		}
		entry = &storage.CustomerCodeEntry{CodeID: codeDoc.ID.Hex(), Code: codeDoc.CustomerCode}
	default:
		return h.errorResponse(http.StatusForbidden, "Forbidden: Invalid role for this action"), nil
	}

	if err := h.db.AddCustomerAssociation(customerID, entry); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to update customer associations"), nil
	}
	return h.successResponse(nil, http.StatusOK), nil
}

func (h *LambdaHandler) getLocations(userClaim map[string]interface{}, accountIDStr string) (events.APIGatewayProxyResponse, error) {
	accountID, err := primitive.ObjectIDFromHex(accountIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid accountID"), nil
	}
	// NOTE: Simplified authorization. A real implementation would be more robust.
	// Allow admin or if the user is requesting their own locations.
	if userClaim["role"] != storage.RoleAdmin && userClaim["id"] != accountIDStr {
		return h.errorResponse(http.StatusForbidden, "Unauthorized"), nil
	}

	acc, err := h.db.GetAccountByID(accountID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "account not found"), nil
	}

	if acc.Role == storage.RoleCompany {
		locations, err := h.db.GetCompanyLocations(bson.M{"companyId": accountID})
		if err != nil {
			return h.errorResponse(http.StatusInternalServerError, "failed to get company locations"), nil
		}
		return h.successResponse(locations, http.StatusOK), nil
	}
	if acc.Role == storage.RoleCustomer || acc.Role == storage.RoleB2C {
		addresses, err := h.db.GetCustomerAddresses(bson.M{"customerId": accountID})
		if err != nil {
			return h.errorResponse(http.StatusInternalServerError, "failed to get customer addresses"), nil
		}
		return h.successResponse(addresses, http.StatusOK), nil
	}
	return h.errorResponse(http.StatusBadRequest, "role not supported for locations"), nil
}

func (h *LambdaHandler) upsertLocation(userClaim map[string]interface{}, accountIDStr string, body string) (events.APIGatewayProxyResponse, error) {
	accountID, err := primitive.ObjectIDFromHex(accountIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid accountID"), nil
	}
	// Authorization
	if userClaim["id"] != accountIDStr {
		return h.errorResponse(http.StatusForbidden, "Unauthorized"), nil
	}

	acc, _ := h.db.GetAccountByID(accountID)
	switch acc.Role {
	case storage.RoleCompany:
		var loc storage.CompanyLocation
		if err := json.Unmarshal([]byte(body), &loc); err != nil {
			return h.errorResponse(http.StatusBadRequest, "invalid request body"), nil
		}
		loc.CompanyID = accountID
		// Simplified upsert logic from original
		loc.ID = primitive.NewObjectID()
		if err := h.db.CreateCompanyLocation(&loc); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "failed to create company location"), nil
		}
		return h.successResponse(loc, http.StatusCreated), nil

	case storage.RoleCustomer, storage.RoleB2C:
		var addr storage.CustomerAddress
		if err := json.Unmarshal([]byte(body), &addr); err != nil {
			return h.errorResponse(http.StatusBadRequest, "invalid request body"), nil
		}
		addr.CustomerID = accountID
		// Simplified upsert logic from original
		addr.ID = primitive.NewObjectID()
		if err := h.db.CreateCustomerAddress(&addr); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "failed to create customer address"), nil
		}
		return h.successResponse(addr, http.StatusCreated), nil
	}
	return h.errorResponse(http.StatusBadRequest, "role not supported for locations"), nil
}

func (h *LambdaHandler) deleteLocation(userClaim map[string]interface{}, accountIDStr string, locationIDStr string) (events.APIGatewayProxyResponse, error) {
	accountID, err := primitive.ObjectIDFromHex(accountIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid accountID"), nil
	}
	locationID, err := primitive.ObjectIDFromHex(locationIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid locationID"), nil
	}
	// Authorization
	if userClaim["id"] != accountIDStr && userClaim["role"] != storage.RoleAdmin {
		return h.errorResponse(http.StatusForbidden, "Unauthorized"), nil
	}

	acc, _ := h.db.GetAccountByID(accountID)
	switch acc.Role {
	case storage.RoleCompany:
		if err := h.db.DeleteCompanyLocation(locationID); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "failed to delete company location"), nil
		}
	case storage.RoleCustomer, storage.RoleB2C:
		if err := h.db.DeleteCustomerAddress(locationID); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "failed to delete customer address"), nil
		}
	default:
		return h.errorResponse(http.StatusBadRequest, "role not supported for locations"), nil
	}
	return h.successResponse(nil, http.StatusNoContent), nil
}

// --- Utility Functions ---

func (h *LambdaHandler) errorResponse(statusCode int, message string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"message": message})
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(body),
	}
}

func (h *LambdaHandler) successResponse(data interface{}, statusCode int) events.APIGatewayProxyResponse {
	var body string
	if data != nil {
		jsonBody, err := json.Marshal(data)
		if err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to marshal response")
		}
		body = string(jsonBody)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       body,
	}
}

// ---------- visitor analytics ----------

// metaFloat coerces a JSON-decoded number to float64; returns 0 for anything
// else. JSON numbers always decode as float64 into map[string]interface{}, so
// that is the only case to handle.
func metaFloat(v interface{}) float64 {
	if n, ok := v.(float64); ok {
		return n
	}
	return 0
}

// parseConversionContents maps a piped items array ([{id|productId, quantity,
// price}]) into conversion line items. Tolerant of missing/oddly-typed fields.
func parseConversionContents(v interface{}) []conversion.Content {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	out := make([]conversion.Content, 0, len(arr))
	for _, it := range arr {
		m, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		id, _ := m["id"].(string)
		if id == "" {
			id, _ = m["productId"].(string)
		}
		if id == "" {
			continue
		}
		qty := int(metaFloat(m["quantity"]))
		if qty <= 0 {
			qty = 1
		}
		out = append(out, conversion.Content{ProductID: id, Quantity: qty, ItemPrice: metaFloat(m["price"])})
	}
	return out
}

func (h *LambdaHandler) trackVisitorEvent(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var req struct {
		VisitorID    string                 `json:"visitorId"`
		Event        string                 `json:"event"`
		Page         string                 `json:"page"`
		Referrer     string                 `json:"referrer"`
		UTMSource    string                 `json:"utm_source"`
		UTMMedium    string                 `json:"utm_medium"`
		UTMCampaign  string                 `json:"utm_campaign"`
		UTMContent   string                 `json:"utm_content"`
		UTMTerm      string                 `json:"utm_term"`
		ClickIDs     map[string]string      `json:"clickIds"`
		Timezone     string                 `json:"timezone"`
		ScreenWidth  int                    `json:"screenWidth"`
		ScreenHeight int                    `json:"screenHeight"`
		Language     string                 `json:"language"`
		CustomerID   string                 `json:"customerId"`
		SellerID     string                 `json:"sellerId"`
		Metadata     map[string]interface{} `json:"metadata"`
	}

	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	if req.VisitorID == "" || req.Event == "" {
		return h.errorResponse(http.StatusBadRequest, "visitorId and event are required"), nil
	}

	// Skip internal users (admin, company, partner). Capture the shopper's email
	// for conversion match quality while we already have the account loaded.
	var customerEmail string
	if req.CustomerID != "" {
		if oid, err := primitive.ObjectIDFromHex(req.CustomerID); err == nil {
			if acc, err := h.db.GetAccountByID(oid); err == nil {
				if acc.Role == storage.RoleAdmin || acc.Role == storage.RoleCompany || acc.Role == storage.RolePartner {
					return h.successResponse(map[string]string{"status": "skipped"}, http.StatusOK), nil
				}
				customerEmail = acc.Email
			}
		}
	}

	// Read CloudFront headers
	headers := request.Headers
	country := headers["CloudFront-Viewer-Country"]
	region := headers["CloudFront-Viewer-Country-Region"]
	city := headers["CloudFront-Viewer-City"]
	timezone := headers["CloudFront-Viewer-Time-Zone"]
	if timezone == "" {
		timezone = req.Timezone
	}
	ip := headers["X-Forwarded-For"]
	if i := strings.Index(ip, ","); i > 0 {
		ip = strings.TrimSpace(ip[:i])
	}
	asn := headers["CloudFront-Viewer-ASN"]
	userAgent := headers["User-Agent"]
	if userAgent == "" {
		userAgent = headers["user-agent"]
	}

	// Detect device from CloudFront headers
	device := "desktop"
	if headers["CloudFront-Is-Mobile-Viewer"] == "true" {
		device = "mobile"
	} else if headers["CloudFront-Is-Tablet-Viewer"] == "true" {
		device = "tablet"
	} else if headers["CloudFront-Is-SmartTV-Viewer"] == "true" {
		device = "smarttv"
	}

	// Parse browser and OS from User-Agent
	browser, os := parseUserAgent(userAgent)

	// Fix: iPhone/iPad requesting desktop site reports "Macintosh" in UA
	if device == "mobile" && os == "macOS" {
		os = "iOS"
	}

	// Detect bots
	isBot, botName := detectBot(userAgent, asn)

	// Infer source from referrer if no UTM
	source := req.UTMSource
	medium := req.UTMMedium
	if source == "" && req.Referrer != "" {
		source, medium = inferSource(req.Referrer)
	}
	if source == "" {
		source = "direct"
		medium = "direct"
	}
	if isBot {
		medium = "bot"
	}

	// Build visitor object
	visitor := &storage.Visitor{
		VisitorID: req.VisitorID,
		SellerID:  req.SellerID,
		Attribution: storage.VisitorAttribution{
			Source:      source,
			Medium:      medium,
			Campaign:    req.UTMCampaign,
			Content:     req.UTMContent,
			Term:        req.UTMTerm,
			Referrer:    req.Referrer,
			LandingPage: req.Page,
			ClickIDs:    req.ClickIDs,
		},
		Geo: storage.VisitorGeo{
			Country:  country,
			Region:   region,
			City:     city,
			Timezone: timezone,
			IP:       ip,
			ASN:      asn,
		},
		Device:       device,
		OS:           os,
		Browser:      browser,
		IsBot:        isBot,
		BotName:      botName,
		ScreenWidth:  req.ScreenWidth,
		ScreenHeight: req.ScreenHeight,
		Language:     req.Language,
		Pages:        []string{req.Page},
		CustomerID:   req.CustomerID,
	}

	// Upsert visitor — if it fails, save a raw doc with error log
	if err := h.db.UpsertVisitor(visitor); err != nil {
		errMsg := fmt.Sprintf("%s: %v", time.Now().Format(time.RFC3339), err)
		log.Printf("ERROR: UpsertVisitor failed: %v", err)
		visitor.ErrorLog = []string{errMsg}
		// Try to at least save the raw data with error
		h.db.UpsertVisitor(visitor)
	}

	// Handle milestone events — errors are logged, never block the response
	now := time.Now()
	logErr := func(action string, err error) {
		if err != nil {
			errMsg := fmt.Sprintf("%s: %s: %v", now.Format(time.RFC3339), action, err)
			log.Printf("WARN: visitor event: %s", errMsg)
			h.db.AppendVisitorError(req.VisitorID, errMsg)
		}
	}

	// Server-side ad-platform conversions (Meta CAPI; Google later). Best-effort:
	// bounded, panic-safe, and never blocks the ingestion response. Credentials
	// live encrypted on the seller's company account (accounts.adConversions).
	// Results are attached to the milestone metadata below for the Analytics view.
	if h.conversions != nil {
		var evName string
		switch req.Event {
		case "order":
			evName = "Purchase"
		case "initiate_checkout":
			evName = "InitiateCheckout"
		case "add_to_cart":
			evName = "AddToCart"
		case "view_content":
			evName = "ViewContent"
		}
		if evName != "" && req.SellerID != "" {
			// Enabled+configured creds, served from the warm-container cache;
			// the DB is hit only on a miss/expiry (see convCache TTL).
			enabledCreds := h.convCache.Get(req.SellerID, func() map[string]map[string]string {
				out := map[string]map[string]string{}
				sellerOID, err := primitive.ObjectIDFromHex(req.SellerID)
				if err != nil {
					return out
				}
				sellerAcc, aerr := h.db.GetAccountByID(sellerOID)
				if aerr != nil {
					return out
				}
				for provider, creds := range sellerAcc.AdConversions {
					if sellerAcc.AdConversionsEnabled[provider] {
						out[provider] = creds
					}
				}
				return out
			})
			if len(enabledCreds) > 0 {
				ev := conversion.Event{
					EventName:  evName,
					SellerID:   req.SellerID,
					EventTime:  now,
					Currency:   "USD",
					Country:    "us",
					Email:      customerEmail,
					ExternalID: req.VisitorID,
					ClientIP:   ip,
					ClientUA:   userAgent,
					Fbclid:     req.ClickIDs["fbclid"],
					Gclid:      req.ClickIDs["gclid"],
				}
				switch req.Event {
				case "order":
					if v, ok := req.Metadata["orderId"].(string); ok {
						ev.EventID = v
					}
					ev.Value = metaFloat(req.Metadata["amount"])
					ev.Contents = parseConversionContents(req.Metadata["items"])
				case "initiate_checkout":
					ev.Value = metaFloat(req.Metadata["amount"])
					ev.Contents = parseConversionContents(req.Metadata["items"])
					// No order exists yet, so key dedup on the visitor + hour bucket:
					// accidental re-fires within the hour collapse at Meta; a genuine
					// checkout in a later hour is counted.
					ev.EventID = fmt.Sprintf("%s:ic:%d", req.VisitorID, now.Unix()/3600)
				case "add_to_cart", "view_content":
					pid, _ := req.Metadata["productId"].(string)
					price := metaFloat(req.Metadata["price"])
					if pid != "" {
						ev.Contents = []conversion.Content{{ProductID: pid, Quantity: 1, ItemPrice: price}}
						ev.Value = price
						tag := "atc"
						if req.Event == "view_content" {
							tag = "vc"
						}
						// Coarse hour bucket: accidental double-fires within the
						// hour dedup at Meta; genuine repeat views/adds across hours
						// are counted (not collapsed).
						ev.EventID = fmt.Sprintf("%s:%s:%s:%d", req.VisitorID, tag, pid, now.Unix()/3600)
					}
				}
				// Require a dedup key: an order with no orderId, or an add_to_cart
				// with no productId, carries no usable content and cannot be deduped
				// at Meta (retries would double-count). Skip rather than send junk.
				if ev.EventID != "" {
					if results := h.conversions.Send(ev, enabledCreds); len(results) > 0 {
						if req.Metadata == nil {
							req.Metadata = map[string]interface{}{}
						}
						req.Metadata["capi"] = results
					}
				}
			}
		}
	}

	switch req.Event {
	case "register":
		milestone := storage.VisitorMilestone{Event: "register", Date: now, Metadata: req.Metadata}
		logErr("addMilestone", h.db.AddVisitorMilestone(req.VisitorID, milestone))
		existing, _ := h.db.GetVisitorByID(req.VisitorID)
		if existing != nil {
			days := int(now.Sub(existing.FirstVisit).Hours() / 24)
			logErr("updateConversion", h.db.UpdateVisitorConversion(req.VisitorID, bson.M{
				"registered": true, "registeredAt": now,
				"customerId": req.CustomerID, "daysToRegister": days,
			}))
		}
	case "login":
		if req.CustomerID != "" {
			logErr("linkCustomer", h.db.UpdateVisitorConversion(req.VisitorID, bson.M{"customerId": req.CustomerID}))
		}
	case "add_to_cart":
		milestone := storage.VisitorMilestone{Event: "add_to_cart", Page: req.Page, Date: now, Metadata: req.Metadata}
		logErr("addMilestone", h.db.AddVisitorMilestone(req.VisitorID, milestone))
	case "initiate_checkout":
		milestone := storage.VisitorMilestone{Event: "initiate_checkout", Page: req.Page, Date: now, Metadata: req.Metadata}
		logErr("addMilestone", h.db.AddVisitorMilestone(req.VisitorID, milestone))
	case "view_content":
		// ViewContent is not persisted as a milestone (avoids per-view bloat under
		// high storefront view volume). Tally successful CAPI sends on a counter
		// for the "Product Views Sent" analytics tile.
		if capi, ok := req.Metadata["capi"].([]conversion.Result); ok {
			sent := 0
			for _, r := range capi {
				if r.Status == "sent" {
					sent++
				}
			}
			if sent > 0 {
				logErr("incViewContentSent", h.db.IncVisitorViewContentSent(req.VisitorID, sent))
			}
		}
	case "order":
		milestone := storage.VisitorMilestone{Event: "order", Date: now, Metadata: req.Metadata}
		logErr("addMilestone", h.db.AddVisitorMilestone(req.VisitorID, milestone))
		amount, _ := req.Metadata["amount"].(float64)
		existing, _ := h.db.GetVisitorByID(req.VisitorID)
		updates := bson.M{"ordered": true, "updatedAt": now}
		if existing != nil {
			if !existing.Ordered {
				updates["firstOrderAt"] = now
				days := int(now.Sub(existing.FirstVisit).Hours() / 24)
				updates["daysToOrder"] = days
			}
			updates["totalOrders"] = existing.TotalOrders + 1
			updates["totalRevenue"] = existing.TotalRevenue + amount
		}
		logErr("updateConversion", h.db.UpdateVisitorConversion(req.VisitorID, updates))
	case "visit":
		milestone := storage.VisitorMilestone{Event: "visit", Page: req.Page, Date: now}
		h.db.AddVisitorMilestone(req.VisitorID, milestone)
	}

	return h.successResponse(map[string]string{"status": "ok"}, http.StatusOK), nil
}

func (h *LambdaHandler) handleVisitors(userClaim map[string]interface{}, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	role, _ := userClaim["role"].(string)
	if role != storage.RoleAdmin && role != storage.RoleCompany {
		return h.errorResponse(http.StatusForbidden, "Access denied"), nil
	}

	// Determine sellerId scope
	// Admin: no param = all data, ?sellerId=portal = portal only, ?sellerId=X = company X
	// Company: forced to their own sellerId
	sellerID := ""
	if role == storage.RoleCompany {
		sellerID, _ = userClaim["id"].(string)
		if sellerID == "" {
			return h.errorResponse(http.StatusForbidden, "Invalid account"), nil
		}
	} else if role == storage.RoleAdmin {
		sellerID = request.QueryStringParameters["sellerId"]
	}

	since := request.QueryStringParameters["since"]

	switch {
	case request.Path == "/visitors/stats" && request.HTTPMethod == "GET":
		return h.getVisitorStats(sellerID, since)
	case request.Path == "/visitors" && request.HTTPMethod == "GET":
		return h.getVisitors(request, sellerID, since)
	case request.Path == "/visitors" && request.HTTPMethod == "DELETE" && role == storage.RoleAdmin:
		vid := request.QueryStringParameters["visitorId"]
		if vid == "" {
			return h.errorResponse(http.StatusBadRequest, "visitorId required"), nil
		}
		if err := h.db.DeleteVisitor(vid); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to delete visitor"), nil
		}
		return h.successResponse(map[string]string{"status": "deleted"}, http.StatusOK), nil
	}
	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

func (h *LambdaHandler) getVisitorStats(sellerID, since string) (events.APIGatewayProxyResponse, error) {
	stats, err := h.db.GetVisitorStats(sellerID, since)
	if err != nil {
		log.Printf("ERROR: GetVisitorStats: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to get visitor stats"), nil
	}
	return h.successResponse(stats, http.StatusOK), nil
}

func (h *LambdaHandler) getVisitors(request events.APIGatewayProxyRequest, sellerID, since string) (events.APIGatewayProxyResponse, error) {
	filter := bson.M{}
	if sellerID == "portal" {
		filter["sellerId"] = bson.M{"$in": []interface{}{nil, ""}}
	} else if sellerID != "" {
		filter["sellerId"] = sellerID
	}

	// Time range filter
	if since != "" {
		var sinceTime time.Time
		switch since {
		case "24h":
			sinceTime = time.Now().Add(-24 * time.Hour)
		case "7d":
			sinceTime = time.Now().AddDate(0, 0, -7)
		case "30d":
			sinceTime = time.Now().AddDate(0, 0, -30)
		}
		if !sinceTime.IsZero() {
			filter["lastVisit"] = bson.M{"$gte": sinceTime}
		}
	}

	q := request.QueryStringParameters

	// Filter by source
	if v := q["source"]; v != "" {
		filter["attribution.source"] = v
	}
	// Filter by country
	if v := q["country"]; v != "" {
		filter["geo.country"] = v
	}
	// Filter by device
	if v := q["device"]; v != "" {
		filter["device"] = v
	}
	// Filter bots
	if v := q["isBot"]; v == "true" {
		filter["isBot"] = true
	} else if v == "false" {
		filter["isBot"] = false
	}
	// Filter registered
	if v := q["registered"]; v == "true" {
		filter["registered"] = true
	}
	// Filter ordered
	if v := q["ordered"]; v == "true" {
		filter["ordered"] = true
	}
	// Filter added-to-cart: any visitor whose milestones include an add_to_cart event.
	if v := q["addedToCart"]; v == "true" {
		filter["milestones.event"] = "add_to_cart"
	}
	// Filter contacted-us: portal visitor reached /contact-us after landing elsewhere.
	if v := q["contactedUs"]; v == "true" {
		filter["pages"] = "/contact-us"
		filter["attribution.landingPage"] = bson.M{"$ne": "/contact-us"}
	}
	// Search by visitorId
	if v := q["visitorId"]; v != "" {
		filter["visitorId"] = v
	}

	page := int64(1)
	if v := q["page"]; v != "" {
		var p int64
		if _, err := fmt.Sscanf(v, "%d", &p); err == nil && p > 0 {
			page = p
		}
	}
	perPage := int64(50)
	if v := q["perPage"]; v != "" {
		var pp int64
		if _, err := fmt.Sscanf(v, "%d", &pp); err == nil && pp > 0 && pp <= 100 {
			perPage = pp
		}
	}

	skip := (page - 1) * perPage
	visitors, total, err := h.db.GetVisitors(filter, skip, perPage)
	if err != nil {
		log.Printf("ERROR: GetVisitors: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to get visitors"), nil
	}

	return h.successResponse(map[string]interface{}{
		"visitors": visitors,
		"total":    total,
		"page":     page,
		"perPage":  perPage,
	}, http.StatusOK), nil
}

// validateCompanyFieldTypes enforces the API contract: payload fields with
// known types in CompanyData must arrive as that type. Empty strings for
// numeric fields, strings for booleans, etc. are rejected with 400 BEFORE
// any DB write — preventing the silent corruption pattern where a cleared
// <input type=number> on the admin form sends "" and the BSON decoder later
// 500s on every read of that doc.
//
// Rules:
//   - numericFields: must be float64 if present and non-null
//   - booleanFields: must be bool if present and non-null
//   - null is allowed for any optional field (clears it)
//   - missing fields are allowed (partial update — backward compatible)
//   - any other field passes through unchanged (string sanitization, D2C,
//     customerGroups validation are handled downstream as before)
func validateCompanyFieldTypes(company map[string]interface{}) error {
	numericFields := []string{
		"shippingRate", "taxRate", "creditLimit", "leadTime",
		"minOrderAmountLimit", "maxOrderAmountLimit",
		"minOrderQuantityLimit", "maxOrderQuantityLimit",
		"monthlyOrderLimit", "yearlyOrderLimit",
	}
	for _, field := range numericFields {
		v, ok := company[field]
		if !ok || v == nil {
			continue
		}
		if _, isNum := v.(float64); !isNum {
			return fmt.Errorf("%s must be a number, got %T (%v)", field, v, v)
		}
	}

	booleanFields := []string{"taxableGoods", "quotesAllowed", "couponsEnabled"}
	for _, field := range booleanFields {
		v, ok := company[field]
		if !ok || v == nil {
			continue
		}
		if _, isBool := v.(bool); !isBool {
			return fmt.Errorf("%s must be a boolean, got %T (%v)", field, v, v)
		}
	}

	return nil
}

func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("Password must be at least 8 characters")
	}
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsDigit(c):
			hasDigit = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}
	if !hasUpper {
		return fmt.Errorf("Password must contain at least one uppercase letter")
	}
	if !hasLower {
		return fmt.Errorf("Password must contain at least one lowercase letter")
	}
	if !hasDigit {
		return fmt.Errorf("Password must contain at least one digit")
	}
	if !hasSpecial {
		return fmt.Errorf("Password must contain at least one special character")
	}
	return nil
}

func parseUserAgent(ua string) (browser, os string) {
	ua = strings.ToLower(ua)
	// Browser
	switch {
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "edg"):
		browser = "Chrome"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		browser = "Safari"
	case strings.Contains(ua, "firefox"):
		browser = "Firefox"
	case strings.Contains(ua, "edg"):
		browser = "Edge"
	default:
		browser = "Other"
	}
	// OS
	switch {
	case strings.Contains(ua, "windows"):
		os = "Windows"
	case strings.Contains(ua, "macintosh") || strings.Contains(ua, "mac os"):
		os = "macOS"
	case strings.Contains(ua, "linux") && !strings.Contains(ua, "android"):
		os = "Linux"
	case strings.Contains(ua, "android"):
		os = "Android"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad"):
		os = "iOS"
	default:
		os = "Other"
	}
	return
}

func detectBot(ua, asn string) (bool, string) {
	bots := map[string]string{
		"googlebot": "Googlebot", "bingbot": "Bingbot", "gptbot": "GPTBot",
		"perplexitybot": "PerplexityBot", "claudebot": "ClaudeBot", "ccbot": "CCBot",
		"twitterbot": "Twitterbot", "facebookexternalhit": "FacebookBot",
		"linkedinbot": "LinkedInBot", "slackbot": "Slackbot", "whatsapp": "WhatsApp",
		"yandexbot": "YandexBot", "duckduckbot": "DuckDuckBot", "applebot": "AppleBot",
		"semrushbot": "SemrushBot", "ahrefsbot": "AhrefsBot",
	}
	lower := strings.ToLower(ua)
	for key, name := range bots {
		if strings.Contains(lower, key) {
			return true, name
		}
	}
	// Known datacenter ASNs (likely bots)
	botASNs := map[string]bool{"16509": true, "14618": true, "15169": true, "8075": true}
	if botASNs[asn] && !strings.Contains(lower, "mozilla") {
		return true, "datacenter"
	}
	return false, ""
}

func inferSource(referrer string) (source, medium string) {
	r := strings.ToLower(referrer)
	switch {
	case strings.Contains(r, "google."):
		return "google", "organic"
	case strings.Contains(r, "bing."):
		return "bing", "organic"
	case strings.Contains(r, "reddit.com"):
		return "reddit", "social"
	case strings.Contains(r, "linkedin.com"):
		return "linkedin", "social"
	case strings.Contains(r, "facebook.com") || strings.Contains(r, "fb.com"):
		return "facebook", "social"
	case strings.Contains(r, "instagram.com"):
		return "instagram", "social"
	case strings.Contains(r, "twitter.com") || strings.Contains(r, "t.co"):
		return "twitter", "social"
	case strings.Contains(r, "youtube.com"):
		return "youtube", "social"
	case strings.Contains(r, "tiktok.com"):
		return "tiktok", "social"
	case strings.Contains(r, "wa.me") || strings.Contains(r, "whatsapp.com"):
		return "whatsapp", "social"
	case strings.Contains(r, "chat.openai.com") || strings.Contains(r, "chatgpt.com"):
		return "chatgpt", "llm"
	case strings.Contains(r, "perplexity.ai"):
		return "perplexity", "llm"
	case strings.Contains(r, "claude.ai"):
		return "claude", "llm"
	case strings.Contains(r, "gemini.google.com"):
		return "gemini", "llm"
	case strings.Contains(r, "copilot.microsoft.com"):
		return "copilot", "llm"
	case strings.Contains(r, "meta.ai"):
		return "meta-ai", "llm"
	case strings.Contains(r, "grok.x.ai") || strings.Contains(r, "x.ai"):
		return "grok", "llm"
	case strings.Contains(r, "you.com"):
		return "you", "llm"
	case strings.Contains(r, "phind.com"):
		return "phind", "llm"
	case strings.Contains(r, "duckduckgo.com"):
		return "duckduckgo", "organic"
	case strings.Contains(r, "yahoo."):
		return "yahoo", "organic"
	default:
		return "referral", "referral"
	}
}

package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"business-cart/account-service/internal/auth"
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

type LambdaHandler struct {
	db               *storage.DB
	jwtSecret        string
	jwtRefreshSecret string
	d2cBucketName      string
	d2cDistributionId  string
	requestOrigin      string // set per-request from Origin header
}

func NewLambdaHandler(db *storage.DB, jwtSecret, jwtRefreshSecret, d2cBucketName, d2cDistributionId string) *LambdaHandler {
	return &LambdaHandler{
		db:                 db,
		jwtSecret:          jwtSecret,
		jwtRefreshSecret:   jwtRefreshSecret,
		d2cBucketName:      d2cBucketName,
		d2cDistributionId:  d2cDistributionId,
	}
}

func (h *LambdaHandler) HandleRequest(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
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

	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
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
	if code, ok := request.PathParameters["code"]; ok && request.HTTPMethod == "GET" {
		return h.getCode(userClaim, code)
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

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to hash password"), nil
	}

	acc := &storage.Account{
		ID:            primitive.NewObjectID(),
		Name:          strings.TrimSpace(req.Name),
		Email:         strings.TrimSpace(req.Email),
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
		var partnerCode, partnerCodeID string
		if req.Code != "" {
			codeDoc, err := h.db.GetCode(bson.M{"partnerCode": req.Code, "is_claimed": false})
			if err != nil {
				return h.errorResponse(http.StatusBadRequest, "invalid or already-claimed partner code"), nil
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
	return h.successResponse(acc, http.StatusCreated), nil
}

func (h *LambdaHandler) login(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	var creds storage.LoginRequest
	if err := json.Unmarshal([]byte(request.Body), &creds); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid body"), nil
	}

	user, err := h.db.GetAccountByEmail(creds.Email)
	if err != nil || !auth.CheckPasswordHash(creds.Password, user.Password) {
		return h.errorResponse(http.StatusUnauthorized, "Invalid credentials"), nil
	}

	var assocIDs []string
	var configs []auth.CustomerConfiguration
	if (user.Role == storage.RoleCustomer || user.Role == storage.RoleB2C) && user.CustomerData != nil {
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

// --- Protected Handlers ---

func (h *LambdaHandler) getAccounts(userClaim map[string]interface{}, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Implementation adapted from original GetAccounts
	role := userClaim["role"].(string)
	userID := userClaim["id"].(string)

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

	return h.successResponse(acc, http.StatusOK), nil
}

func (h *LambdaHandler) updateAccount(userClaim map[string]interface{}, id string, body string, jwtToken string) (events.APIGatewayProxyResponse, error) {
	// Implementation adapted from original UpdateAccount
	targetID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	// Authorization
	role := userClaim["role"].(string)
	userID := userClaim["id"].(string)
	if role != storage.RoleAdmin && userID != targetID.Hex() {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}

	var payload struct {
		Company map[string]interface{} `json:"company"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid body"), nil
	}

	// Sanitize string fields that affect URLs and display
	for k, v := range payload.Company {
		if str, ok := v.(string); ok {
			if k == "name" || k == "contactEmail" || k == "contactPhone" {
				payload.Company[k] = strings.TrimSpace(str)
			}
		}
	}

	setFields := bson.M{}
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

		setFields["company."+k] = v
	}

	if len(setFields) == 0 {
		return h.errorResponse(http.StatusBadRequest, "Nothing to update"), nil
	}

	if err := h.db.UpdateAccount(targetID, setFields); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Update failed"), nil
	}

	// Trigger D2C generation if enabled (this will also generate PreviewDomain if missing)
	if err := h.triggerD2CGeneration(targetID, jwtToken); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Storefront generation failed: "+err.Error()), nil
	}

	// Return the updated account to the frontend so it sees the generated PreviewDomain
	updatedAcc, err := h.db.GetAccountByID(targetID)
	if err != nil {
		return h.successResponse(nil, http.StatusOK), nil
	}

	return h.successResponse(updatedAcc, http.StatusOK), nil
}

func (h *LambdaHandler) regenerateStorefront(userClaim map[string]interface{}, id string, jwtToken string) (events.APIGatewayProxyResponse, error) {
	targetID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	// Authorization - Admin or the company itself
	role := userClaim["role"].(string)
	userID := userClaim["id"].(string)
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

	// 5. Run Generator
	genData := generator.StorefrontData{
		AccountID: acc.ID.Hex(),
		Company:   acc.CompanyData,
		Config:    acc.CompanyData.D2C,
		Products:  products,
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

func (h *LambdaHandler) deleteAccount(userClaim map[string]interface{}, id string) (events.APIGatewayProxyResponse, error) {
	// Authorization: simple admin check
	if userClaim["role"] != storage.RoleAdmin {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}
	objID, _ := primitive.ObjectIDFromHex(id)
	_ = h.db.DeleteAccount(objID)
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
	// ... rest of the logic from original CreateCode
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
	companyID := userClaim["id"].(string)

	var config storage.CustomerConfiguration
	if err := json.Unmarshal([]byte(body), &config); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	if err := h.db.UpdateCustomerConfiguration(customerID, companyID, &config); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to update configuration"), nil
	}
	return h.successResponse(nil, http.StatusOK), nil
}

func (h *LambdaHandler) associateCustomerWithCompany(userClaim map[string]interface{}, customerIDStr string, body string) (events.APIGatewayProxyResponse, error) {
	customerID, err := primitive.ObjectIDFromHex(customerIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid customer ID"), nil
	}

	role := userClaim["role"].(string)
	actorID := userClaim["id"].(string)

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

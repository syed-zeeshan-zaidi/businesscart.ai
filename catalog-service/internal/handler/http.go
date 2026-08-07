package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"business-cart/catalog-service/internal/storage"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-playground/validator/v10"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var validate *validator.Validate

func init() {
	validate = validator.New()
}

type LambdaHandler struct {
	db            *storage.DB
	jwtSecret     string
	s3Client      *s3.Client
	s3Bucket      string
	cdnDomain     string
	requestOrigin string
}

func NewLambdaHandler(db *storage.DB, jwtSecret string, s3Client *s3.Client, s3Bucket, cdnDomain string) *LambdaHandler {
	return &LambdaHandler{
		db:        db,
		jwtSecret: jwtSecret,
		s3Client:  s3Client,
		s3Bucket:  s3Bucket,
		cdnDomain: cdnDomain,
	}
}

// hidesCost reports whether this caller must never see confidential seller cost.
//
// Buyers, for the reason #40 records. And staff INSIDE the selling organisation
// whose seniority is "user" (Roadmap #35g): a sales rep processes orders and
// maintains the catalogue, but what the goods cost the business is not theirs to
// see. Same rule as #40, turned inward.
//
// An ABSENT org_role never hides anything. It is absent on platform-admin tokens,
// and on any token minted before #35g shipped; defaulting those to hidden would
// blank the margin figures of the very people who own them. Every org-capable
// token carries an explicit value.
func hidesCost(role, orgRole string) bool {
	if role == "customer" || role == "b2c" {
		return true
	}
	return role == "company" && orgRole == "user"
}

func (h *LambdaHandler) HandleRequest(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	h.requestOrigin = request.Headers["origin"]
	if h.requestOrigin == "" {
		h.requestOrigin = request.Headers["Origin"]
	}

	// Handle preflight OPTIONS requests
	if request.HTTPMethod == "OPTIONS" {
		return h.successResponse(nil), nil
	}

	// Validate JWT token
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

	// CORRECTLY PARSE NESTED USER CLAIM
	userClaim, ok := claims["user"].(map[string]interface{})
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: User claim is not a map"), nil
	}

	// Validate required claims exist
	if role, _ := userClaim["role"].(string); role == "" {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}
	if id, _ := userClaim["id"].(string); id == "" {
		return h.errorResponse(http.StatusUnauthorized, "Invalid token claims"), nil
	}

	// Route the request
	log.Printf("DEBUG [catalog-service]: Path=%s Method=%s", request.Path, request.HTTPMethod)
	if strings.Contains(request.Path, "/blog") {
		id := ""
		hasID := false
		pathParts := strings.Split(strings.Trim(request.Path, "/"), "/")
		for i, part := range pathParts {
			if part == "blog" && i+1 < len(pathParts) {
				id = pathParts[i+1]
				hasID = true
				break
			}
		}
		switch request.HTTPMethod {
		case "POST":
			return h.createBlogPost(userClaim, request.Body)
		case "GET":
			if hasID {
				return h.getBlogPostByID(userClaim, id)
			}
			return h.getBlogPosts(userClaim)
		case "PUT":
			if hasID {
				return h.updateBlogPost(userClaim, id, request.Body)
			}
		case "DELETE":
			if hasID {
				return h.deleteBlogPost(userClaim, id)
			}
		}
		return h.errorResponse(http.StatusNotFound, "Route not found"), nil
	}
	if strings.Contains(request.Path, "/products") {
		// Handle image upload endpoints first
		if request.Path == "/products/upload-url" && request.HTTPMethod == "POST" {
			return h.getUploadURL(userClaim, request.Body)
		}
		// Manually parse ID from path since template.yaml uses {proxy+}
		id := ""
		hasID := false
		pathParts := strings.Split(strings.Trim(request.Path, "/"), "/")
		for i, part := range pathParts {
			if part == "products" && i+1 < len(pathParts) {
				id = pathParts[i+1]
				hasID = true
				break
			}
		}
		switch request.HTTPMethod {
		case "POST":
			return h.createProduct(userClaim, request.Body)
		case "GET":
			if hasID {
				return h.getProductByID(userClaim, id)
			}
			return h.getProducts(userClaim)
		case "PUT":
			if hasID {
				return h.updateProduct(userClaim, id, request.Body)
			}
		case "DELETE":
			if hasID {
				return h.deleteProduct(userClaim, id)
			}
		}
	}

	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

// orgIDFromClaim resolves the organisation a caller acts within (Roadmap #21c).
//
// Products and blog posts are keyed by the ROOT account's id, so ownership must
// be judged against the organisation rather than the individual account —
// otherwise a second account in the same selling organisation cannot touch its
// own company's catalogue. Tokens minted before this claim existed, and any
// account without a parent, resolve to the account's own id, so behaviour is
// unchanged until a parent is actually assigned.
func orgIDFromClaim(userClaim map[string]interface{}) string {
	if org, _ := userClaim["org_id"].(string); org != "" {
		return org
	}
	id, _ := userClaim["id"].(string)
	return id
}

func (h *LambdaHandler) createProduct(userClaim map[string]interface{}, body string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)
	claimID, _ := userClaim["id"].(string)
	if claimRole != "company" && claimRole != "admin" && claimRole != "partner" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Company, admin or partner role required"), nil
	}

	var product storage.Product
	if err := json.Unmarshal([]byte(body), &product); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	if err := validate.Struct(product); err != nil {
		return h.errorResponse(http.StatusBadRequest, err.Error()), nil
	}

	product.SellerID = orgIDFromClaim(userClaim)
	// Partner products surface through the partner's linked company. SellerID is
	// the linked company; PartnerID is the partner's own account id. Linked
	// company id comes from the JWT (populated at login from partner.companyId).
	if claimRole == "partner" {
		assoc, _ := userClaim["associate_company_ids"].([]interface{})
		if len(assoc) == 0 {
			return h.errorResponse(http.StatusForbidden, "partner not linked to a company"), nil
		}
		companyID, _ := assoc[0].(string)
		if companyID == "" {
			return h.errorResponse(http.StatusForbidden, "partner not linked to a company"), nil
		}
		product.SellerID = companyID
		product.PartnerID = claimID
	} else {
		// Company / admin cannot attribute a product to a partner via the request body.
		product.PartnerID = ""
	}
	product.Name = strings.TrimSpace(product.Name)
	if strings.Contains(product.Name, "/") {
		return h.errorResponse(http.StatusBadRequest, "Product name cannot contain '/'"), nil
	}
	product.Category = strings.TrimSpace(product.Category)
	product.GoogleProductCategory = strings.TrimSpace(product.GoogleProductCategory)
	product.Slug = strings.TrimSpace(product.Slug)
	if product.Slug == "" {
		return h.errorResponse(http.StatusBadRequest, "Slug is required"), nil
	}
	if product.Price <= 0 {
		return h.errorResponse(http.StatusBadRequest, "Price must be greater than 0"), nil
	}
	product.SKU = strings.TrimSpace(product.SKU)
	product.Barcode = strings.TrimSpace(product.Barcode)
	for i := range product.Attributes {
		product.Attributes[i].Key = strings.TrimSpace(product.Attributes[i].Key)
		product.Attributes[i].Value = strings.TrimSpace(product.Attributes[i].Value)
	}
	if err := validatePriceTiers(product.PriceTiers); err != nil {
		return h.errorResponse(http.StatusBadRequest, err.Error()), nil
	}
	product.GroupIDs = sanitizeGroupIDs(product.GroupIDs)

	if err := h.db.CreateProduct(&product); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create product"), nil
	}

	return h.successResponse(product), nil
}

func (h *LambdaHandler) getProducts(userClaim map[string]interface{}) (events.APIGatewayProxyResponse, error) {
	role, _ := userClaim["role"].(string)
	accountID, _ := userClaim["id"].(string)

	var filter bson.M
	switch role {
	case "admin":
		filter = bson.M{}
	case "company":
		// The organisation, not the individual: products are stored under the root's
		// id, so a colleague filtering by their own would get an empty catalogue.
		filter = bson.M{"sellerID": orgIDFromClaim(userClaim)}
	case "partner":
		// Partners stay scoped by their own id: they are scoped by PartnerID, not
		// by the selling organisation.
		filter = bson.M{"partnerId": accountID}
	case "customer":
		associateCompanyIDs, ok := userClaim["associate_company_ids"].([]interface{})
		if !ok {
			return h.successResponse([]*storage.Product{}), nil
		}
		var companyIDs []string
		for _, id := range associateCompanyIDs {
			companyIDs = append(companyIDs, id.(string))
		}
		// B2B group visibility: customer sees ungrouped products + products tagged with their group(s)
		customerGroupIDs := extractCustomerGroupIDs(userClaim)
		visibilityOr := []bson.M{
			{"groupIDs": bson.M{"$exists": false}},
			{"groupIDs": bson.M{"$size": 0}},
		}
		if len(customerGroupIDs) > 0 {
			visibilityOr = append(visibilityOr, bson.M{"groupIDs": bson.M{"$in": customerGroupIDs}})
		}
		filter = bson.M{
			"sellerID": bson.M{"$in": companyIDs},
			"$and": []bson.M{
				{"$or": []bson.M{
					{"active": true},
					{"active": bson.M{"$exists": false}},
				}},
				{"$or": visibilityOr},
			},
		}
	case "b2c":
		// B2C bypasses group visibility entirely — sees all active products from associated companies.
		associateCompanyIDs, ok := userClaim["associate_company_ids"].([]interface{})
		if !ok {
			return h.successResponse([]*storage.Product{}), nil
		}
		var companyIDs []string
		for _, id := range associateCompanyIDs {
			companyIDs = append(companyIDs, id.(string))
		}
		filter = bson.M{
			"sellerID": bson.M{"$in": companyIDs},
			"$or": []bson.M{
				{"active": true},
				{"active": bson.M{"$exists": false}},
			},
		}
	default:
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Invalid role"), nil
	}

	products, err := h.db.GetProducts(filter)
	if err != nil {
		log.Printf("ERROR: GetProducts failed: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to retrieve products"), nil
	}

	if len(products) == 0 {
		return h.successResponse([]*storage.Product{}), nil
	}

	// Discount resolution for B2B customers (B2C never has discounts).
	// Priority: legacy discountPercentage override > group's groupPriceDiscount > none.
	if role == "customer" {
		if customerConfigs, ok := userClaim["configurations"].([]interface{}); ok {
			legacyDiscountMap := make(map[string]float64)
			groupDiscountMap := make(map[string]float64)
			for _, config := range customerConfigs {
				configMap, ok := config.(map[string]interface{})
				if !ok {
					continue
				}
				companyID, _ := configMap["company_id"].(string)
				if companyID == "" {
					continue
				}
				if d, ok := configMap["discount"].(float64); ok && d > 0 {
					legacyDiscountMap[companyID] = d
				}
				if d, ok := configMap["groupPriceDiscount"].(float64); ok && d > 0 {
					groupDiscountMap[companyID] = d
				}
			}

			for _, product := range products {
				var discount float64
				if d, ok := legacyDiscountMap[product.SellerID]; ok {
					discount = d
				} else if d, ok := groupDiscountMap[product.SellerID]; ok {
					discount = d
				}
				if discount > 0 {
					product.DiscountedPrice = product.Price * (1 - discount/100)
				}
			}
		}
	}

	// Confidential seller cost must never reach buyers. Phase 1 protected the
	// storefront/feeds; this closes the authenticated-API leak (Roadmap #40).
	// Extended in #35g to staff inside the seller who are not senior enough.
	if orgRole, _ := userClaim["org_role"].(string); hidesCost(role, orgRole) {
		for _, product := range products {
			product.Cost = 0
		}
	}

	return h.successResponse(products), nil
}

func (h *LambdaHandler) getProductByID(userClaim map[string]interface{}, idStr string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)

	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Product not found"), nil
	}

	// Authorization check for non-admin roles
	if claimRole != "admin" {
		isOwner := product.SellerID == orgIDFromClaim(userClaim)

		isAssociatedCustomer := false
		if claimRole == "customer" || claimRole == "b2c" {
			if assocCompanies, ok := userClaim["associate_company_ids"].([]interface{}); ok {
				for _, companyID := range assocCompanies {
					if companyID.(string) == product.SellerID {
						isAssociatedCustomer = true
						break
					}
				}
			}
		}

		if !isOwner && !isAssociatedCustomer {
			return h.errorResponse(http.StatusForbidden, "Unauthorized to access this product"), nil
		}

		// Customers cannot view inactive products
		if isAssociatedCustomer && product.Active != nil && !*product.Active {
			return h.errorResponse(http.StatusNotFound, "Product not found"), nil
		}
	}

	// Confidential seller cost must never reach buyers (Roadmap #40), nor staff
	// inside the seller who are not senior enough to see it (Roadmap #35g).
	if claimOrgRole, _ := userClaim["org_role"].(string); hidesCost(claimRole, claimOrgRole) {
		product.Cost = 0
	}

	return h.successResponse(product), nil
}

func (h *LambdaHandler) updateProduct(userClaim map[string]interface{}, idStr string, body string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)
	claimID, _ := userClaim["id"].(string)

	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Product not found"), nil
	}

	isOwner := product.SellerID == orgIDFromClaim(userClaim) || (claimRole == "partner" && product.PartnerID == claimID)
	if !isOwner && claimRole != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized to update this product"), nil
	}

	var updates bson.M
	if err := json.Unmarshal([]byte(body), &updates); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	// Prevent updating SellerID or PartnerID; they are stamped at create and immutable
	delete(updates, "sellerID")
	delete(updates, "partnerId")

	// Sanitize text fields that affect URLs and display
	if name, ok := updates["name"].(string); ok {
		name = strings.TrimSpace(name)
		if strings.Contains(name, "/") {
			return h.errorResponse(http.StatusBadRequest, "Product name cannot contain '/'"), nil
		}
		updates["name"] = name
	}
	if category, ok := updates["category"].(string); ok {
		category = strings.TrimSpace(category)
		if strings.Count(category, "/") > 1 {
			return h.errorResponse(http.StatusBadRequest, "Category supports max one '/' for primary / sub hierarchy"), nil
		}
		updates["category"] = category
	}
	if gpc, ok := updates["googleProductCategory"].(string); ok {
		updates["googleProductCategory"] = strings.TrimSpace(gpc)
	}
	// Reviews: backend ALWAYS recomputes count/average/distribution from the reviews
	// array. Never trust client-sent aggregates (security + drift prevention).
	if rating, ok := updates["rating"].(map[string]interface{}); ok {
		updates["rating"] = recomputeRating(rating)
	}
	if slug, ok := updates["slug"].(string); ok {
		slug = strings.TrimSpace(slug)
		if slug == "" {
			return h.errorResponse(http.StatusBadRequest, "Slug cannot be empty"), nil
		}
		if strings.Contains(slug, "/") {
			return h.errorResponse(http.StatusBadRequest, "Slug cannot contain '/'"), nil
		}
		updates["slug"] = slug
	}
	// Coerce price to float64
	if price, ok := updates["price"].(string); ok {
		n, err := strconv.ParseFloat(price, 64)
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid price value"), nil
		}
		updates["price"] = n
	}
	if p, ok := updates["price"].(float64); ok && p <= 0 {
		return h.errorResponse(http.StatusBadRequest, "Price must be greater than 0"), nil
	}
	if dealPrice, ok := updates["dealPrice"].(string); ok {
		n, err := strconv.ParseFloat(dealPrice, 64)
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid deal price value"), nil
		}
		updates["dealPrice"] = n
	}
	// Coerce booleans
	if active, ok := updates["active"].(string); ok {
		updates["active"] = active == "true"
	}
	if featured, ok := updates["featured"].(string); ok {
		updates["featured"] = featured == "true"
	}
	if sku, ok := updates["sku"].(string); ok {
		updates["sku"] = strings.TrimSpace(sku)
	}
	if barcode, ok := updates["barcode"].(string); ok {
		updates["barcode"] = strings.TrimSpace(barcode)
	}
	// Coerce stock to integer (JSON/frontend may send as string or float64)
	if stock, ok := updates["stock"].(string); ok {
		n, err := strconv.Atoi(stock)
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid stock value"), nil
		}
		updates["stock"] = n
	} else if stock, ok := updates["stock"].(float64); ok {
		updates["stock"] = int(stock)
	}
	if attrs, ok := updates["attributes"].([]interface{}); ok {
		for i, a := range attrs {
			if attr, ok := a.(map[string]interface{}); ok {
				if k, ok := attr["key"].(string); ok {
					attr["key"] = strings.TrimSpace(k)
				}
				if v, ok := attr["value"].(string); ok {
					attr["value"] = strings.TrimSpace(v)
				}
				attrs[i] = attr
			}
		}
		updates["attributes"] = attrs
	}

	// Sanitize groupIDs if present (trim, dedupe).
	// Empty result → unsetFields so the key is removed from the doc (honors omitempty rule).
	unsetFields := bson.M{}
	if rawGroupIDs, ok := updates["groupIDs"]; ok {
		if rawGroupIDs == nil {
			delete(updates, "groupIDs")
			unsetFields["groupIDs"] = ""
		} else if arr, ok := rawGroupIDs.([]interface{}); ok {
			ids := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					ids = append(ids, s)
				}
			}
			cleaned := sanitizeGroupIDs(ids)
			if cleaned == nil {
				delete(updates, "groupIDs")
				unsetFields["groupIDs"] = ""
			} else {
				updates["groupIDs"] = cleaned
			}
		}
	}

	// Coerce deal date strings to time.Time (empty → $unset from MongoDB)
	if ds, ok := updates["dealStartDate"].(string); ok {
		if ds == "" {
			delete(updates, "dealStartDate")
			unsetFields["dealStartDate"] = ""
		} else if t, err := time.Parse(time.RFC3339, ds); err == nil {
			updates["dealStartDate"] = t
		} else {
			return h.errorResponse(http.StatusBadRequest, "Invalid dealStartDate, use RFC3339 format"), nil
		}
	}
	if de, ok := updates["dealEndDate"].(string); ok {
		if de == "" {
			delete(updates, "dealEndDate")
			unsetFields["dealEndDate"] = ""
		} else if t, err := time.Parse(time.RFC3339, de); err == nil {
			updates["dealEndDate"] = t
		} else {
			return h.errorResponse(http.StatusBadRequest, "Invalid dealEndDate, use RFC3339 format"), nil
		}
	}

	// Validate priceTiers if present
	if rawTiers, ok := updates["priceTiers"]; ok {
		if rawTiers == nil {
			// Explicitly setting to nil clears tiers — allowed
		} else if tiersSlice, ok := rawTiers.([]interface{}); ok {
			var tiers []storage.PriceTier
			for _, t := range tiersSlice {
				if m, ok := t.(map[string]interface{}); ok {
					minQty := 0
					if v, ok := m["minQty"].(float64); ok {
						minQty = int(v)
					}
					price := 0.0
					if v, ok := m["price"].(float64); ok {
						price = v
					}
					tiers = append(tiers, storage.PriceTier{MinQty: minQty, Price: price})
				}
			}
			if err := validatePriceTiers(tiers); err != nil {
				return h.errorResponse(http.StatusBadRequest, err.Error()), nil
			}
		}
	}

	// Delete removed images from S3
	if newImages, ok := updates["images"].([]interface{}); ok {
		newSet := make(map[string]bool)
		for _, img := range newImages {
			if s, ok := img.(string); ok {
				newSet[s] = true
			}
		}
		var removed []string
		for _, oldUrl := range product.Images {
			if !newSet[oldUrl] {
				removed = append(removed, oldUrl)
			}
		}
		h.deleteProductImages(removed)
	}

	if err := h.db.UpdateProduct(id, updates, unsetFields); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to update product"), nil
	}

	return h.successResponse(nil), nil
}

func (h *LambdaHandler) deleteProduct(userClaim map[string]interface{}, idStr string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)
	claimID, _ := userClaim["id"].(string)

	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Product not found"), nil
	}

	isOwner := product.SellerID == orgIDFromClaim(userClaim) || (claimRole == "partner" && product.PartnerID == claimID)
	if !isOwner && claimRole != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized to delete this product"), nil
	}

	// Delete images from S3
	h.deleteProductImages(product.Images)

	if err := h.db.DeleteProduct(id); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to delete product"), nil
	}

	return h.successResponse(nil), nil
}

func (h *LambdaHandler) deleteProductImages(imageUrls []string) {
	if h.s3Client == nil || h.s3Bucket == "" || len(imageUrls) == 0 {
		return
	}
	prefix := "https://" + h.cdnDomain + "/"
	for _, url := range imageUrls {
		key := strings.TrimPrefix(url, prefix)
		if key == url || key == "" {
			continue
		}
		_, err := h.s3Client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
			Bucket: aws.String(h.s3Bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			log.Printf("WARN: failed to delete S3 image %s: %v", key, err)
		}
	}
}

// --- Blog Post Handlers ---

// isValidSlug enforces lowercase letters, digits, and single hyphens.
// Must start and end with an alphanumeric character. No spaces, no slashes.
func isValidSlug(s string) bool {
	if s == "" {
		return false
	}
	if s[0] == '-' || s[len(s)-1] == '-' {
		return false
	}
	prevHyphen := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		isAlphaNum := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
		isHyphen := c == '-'
		if !isAlphaNum && !isHyphen {
			return false
		}
		if isHyphen && prevHyphen {
			return false
		}
		prevHyphen = isHyphen
	}
	return true
}

func (h *LambdaHandler) createBlogPost(userClaim map[string]interface{}, body string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)
	if claimRole != "company" && claimRole != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Company role required"), nil
	}

	var post storage.BlogPost
	if err := json.Unmarshal([]byte(body), &post); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	post.SellerID = orgIDFromClaim(userClaim)
	post.Title = strings.TrimSpace(post.Title)
	post.Slug = strings.TrimSpace(post.Slug)
	post.Excerpt = strings.TrimSpace(post.Excerpt)
	post.Author = strings.TrimSpace(post.Author)
	post.AuthorBio = strings.TrimSpace(post.AuthorBio)
	post.Category = strings.TrimSpace(post.Category)
	post.MetaTitle = strings.TrimSpace(post.MetaTitle)
	post.MetaDescription = strings.TrimSpace(post.MetaDescription)
	post.FeaturedImage = strings.TrimSpace(post.FeaturedImage)

	if !isValidSlug(post.Slug) {
		return h.errorResponse(http.StatusBadRequest, "Slug must be lowercase letters, digits, and hyphens only"), nil
	}

	if err := validate.Struct(post); err != nil {
		return h.errorResponse(http.StatusBadRequest, err.Error()), nil
	}

	// Slug uniqueness per seller
	if existing, _ := h.db.GetBlogPostBySlug(post.SellerID, post.Slug); existing != nil && !existing.ID.IsZero() {
		return h.errorResponse(http.StatusConflict, "A blog post with this slug already exists"), nil
	}

	if err := h.db.CreateBlogPost(&post); err != nil {
		log.Printf("ERROR: CreateBlogPost failed: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to create blog post"), nil
	}

	return h.successResponse(post), nil
}

func (h *LambdaHandler) getBlogPosts(userClaim map[string]interface{}) (events.APIGatewayProxyResponse, error) {
	role, _ := userClaim["role"].(string)

	var filter bson.M
	switch role {
	case "admin":
		filter = bson.M{}
	case "company":
		// Same reasoning as the product list: blog posts are keyed by the root.
		filter = bson.M{"sellerID": orgIDFromClaim(userClaim)}
	case "customer", "b2c":
		associateCompanyIDs, ok := userClaim["associate_company_ids"].([]interface{})
		if !ok {
			return h.successResponse([]*storage.BlogPost{}), nil
		}
		var companyIDs []string
		for _, id := range associateCompanyIDs {
			companyIDs = append(companyIDs, id.(string))
		}
		filter = bson.M{
			"sellerID": bson.M{"$in": companyIDs},
			"$or": []bson.M{
				{"active": true},
				{"active": bson.M{"$exists": false}},
			},
		}
	default:
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Invalid role"), nil
	}

	posts, err := h.db.GetBlogPosts(filter)
	if err != nil {
		log.Printf("ERROR: GetBlogPosts failed: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to retrieve blog posts"), nil
	}

	if len(posts) == 0 {
		return h.successResponse([]*storage.BlogPost{}), nil
	}

	return h.successResponse(posts), nil
}

func (h *LambdaHandler) getBlogPostByID(userClaim map[string]interface{}, idStr string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)

	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	post, err := h.db.GetBlogPostByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Blog post not found"), nil
	}

	if claimRole != "admin" {
		isOwner := post.SellerID == orgIDFromClaim(userClaim)
		isAssociated := false
		if claimRole == "customer" || claimRole == "b2c" {
			if assoc, ok := userClaim["associate_company_ids"].([]interface{}); ok {
				for _, cid := range assoc {
					if cid.(string) == post.SellerID {
						isAssociated = true
						break
					}
				}
			}
		}
		if !isOwner && !isAssociated {
			return h.errorResponse(http.StatusForbidden, "Unauthorized to access this blog post"), nil
		}
		if isAssociated && post.Active != nil && !*post.Active {
			return h.errorResponse(http.StatusNotFound, "Blog post not found"), nil
		}
	}

	return h.successResponse(post), nil
}

func (h *LambdaHandler) updateBlogPost(userClaim map[string]interface{}, idStr string, body string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)

	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	post, err := h.db.GetBlogPostByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Blog post not found"), nil
	}

	if post.SellerID != orgIDFromClaim(userClaim) && claimRole != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized to update this blog post"), nil
	}

	var updates bson.M
	if err := json.Unmarshal([]byte(body), &updates); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	delete(updates, "sellerID")
	delete(updates, "createdAt")

	// Trim string fields
	for _, k := range []string{"title", "excerpt", "author", "authorBio", "category", "metaTitle", "metaDescription", "featuredImage"} {
		if v, ok := updates[k].(string); ok {
			updates[k] = strings.TrimSpace(v)
		}
	}

	// Slug: validate and check uniqueness if changing
	if slug, ok := updates["slug"].(string); ok {
		slug = strings.TrimSpace(slug)
		if !isValidSlug(slug) {
			return h.errorResponse(http.StatusBadRequest, "Slug must be lowercase letters, digits, and hyphens only"), nil
		}
		if slug != post.Slug {
			if existing, _ := h.db.GetBlogPostBySlug(post.SellerID, slug); existing != nil && !existing.ID.IsZero() && existing.ID != id {
				return h.errorResponse(http.StatusConflict, "A blog post with this slug already exists"), nil
			}
		}
		updates["slug"] = slug
	}

	// Active coerce
	if active, ok := updates["active"].(string); ok {
		updates["active"] = active == "true"
	}

	// PublishedAt coerce (RFC3339 string → time.Time)
	if pa, ok := updates["publishedAt"].(string); ok {
		if pa == "" {
			delete(updates, "publishedAt")
		} else if t, err := time.Parse(time.RFC3339, pa); err == nil {
			updates["publishedAt"] = t
		} else {
			return h.errorResponse(http.StatusBadRequest, "Invalid publishedAt, use RFC3339 format"), nil
		}
	}

	unsetFields := bson.M{}
	if err := h.db.UpdateBlogPost(id, updates, unsetFields); err != nil {
		log.Printf("ERROR: UpdateBlogPost failed: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to update blog post"), nil
	}

	return h.successResponse(nil), nil
}

func (h *LambdaHandler) deleteBlogPost(userClaim map[string]interface{}, idStr string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)

	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	post, err := h.db.GetBlogPostByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Blog post not found"), nil
	}

	if post.SellerID != orgIDFromClaim(userClaim) && claimRole != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized to delete this blog post"), nil
	}

	if err := h.db.DeleteBlogPost(id); err != nil {
		log.Printf("ERROR: DeleteBlogPost failed: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to delete blog post"), nil
	}

	return h.successResponse(nil), nil
}

// --- Image Upload Endpoints ---

func (h *LambdaHandler) getUploadURL(userClaim map[string]interface{}, body string) (events.APIGatewayProxyResponse, error) {
	claimRole, _ := userClaim["role"].(string)
	if claimRole != "company" && claimRole != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Company role required"), nil
	}

	if h.s3Client == nil || h.s3Bucket == "" {
		return h.errorResponse(http.StatusServiceUnavailable, "Image upload not configured"), nil
	}

	var req struct {
		ContentType   string `json:"contentType"`
		FileExtension string `json:"fileExtension"`
		Slug          string `json:"slug"`
		Kind          string `json:"kind"`
		CompanyID     string `json:"companyId"`
	}
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	// Logo uploads are stored without an extension (see the logo branch below),
	// so only the product path requires one. Product behaviour is unchanged.
	if req.ContentType == "" || (req.Kind != "logo" && req.FileExtension == "") {
		return h.errorResponse(http.StatusBadRequest, "contentType and fileExtension are required"), nil
	}

	sellerID, _ := userClaim["id"].(string)

	// Company logo: one fixed key per company, so a re-upload overwrites the
	// previous object instead of accumulating one per upload. Deliberately
	// extensionless — the stored Content-Type drives rendering, so a merchant
	// switching PNG to JPG still leaves exactly one object behind.
	// Admins edit other companies and pass the target id; a company caller can
	// only ever write under its own prefix, and the id is validated as an
	// ObjectID so it can never traverse outside the company's folder.
	if req.Kind == "logo" {
		ownerID := sellerID
		if claimRole == "admin" && req.CompanyID != "" {
			if _, err := primitive.ObjectIDFromHex(req.CompanyID); err != nil {
				return h.errorResponse(http.StatusBadRequest, "Invalid companyId"), nil
			}
			ownerID = req.CompanyID
		}
		// The logo key is FIXED per company, so an empty owner would send every such
		// upload to one shared object at the bucket root ("/assets/logo") and let
		// companies overwrite each other. Product keys carry a per-upload UUID and
		// cannot collide that way, which is why only this path needs the guard.
		if _, err := primitive.ObjectIDFromHex(ownerID); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Could not resolve company for logo upload"), nil
		}
		// A presigned PUT signs whatever Content-Type it is given, and the key is
		// public, guessable and served from the platform's own CDN domain. Without
		// this an authenticated caller could park arbitrary HTML there. The client
		// "accept" attribute is a convenience, never the control. SVG is excluded on
		// purpose: it is scriptable, and no social scraper renders it as an og:image.
		switch req.ContentType {
		case "image/png", "image/jpeg", "image/webp":
		default:
			return h.errorResponse(http.StatusBadRequest, "Logo must be a PNG, JPEG or WebP image"), nil
		}
		logoKey := fmt.Sprintf("%s/assets/logo", ownerID)
		presignClient := s3.NewPresignClient(h.s3Client)
		presignReq, err := presignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
			Bucket:      aws.String(h.s3Bucket),
			Key:         aws.String(logoKey),
			ContentType: aws.String(req.ContentType),
		}, s3.WithPresignExpires(15*time.Minute))
		if err != nil {
			log.Printf("ERROR: Failed to create logo upload URL: %v", err)
			return h.errorResponse(http.StatusInternalServerError, "Failed to generate upload URL"), nil
		}
		return h.successResponse(map[string]string{
			"uploadUrl": presignReq.URL,
			"imageUrl":  fmt.Sprintf("https://%s/%s", h.cdnDomain, logoKey),
		}), nil
	}

	imageID := uuid.New().String()
	ext := req.FileExtension
	filename := "image-" + imageID[:8]
	if req.Slug != "" {
		filename = req.Slug + "-" + imageID[:8]
	}
	key := fmt.Sprintf("%s/%s/%s.%s", sellerID, imageID, filename, ext)

	presignClient := s3.NewPresignClient(h.s3Client)
	presignReq, err := presignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(h.s3Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(req.ContentType),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		log.Printf("ERROR: Failed to create presigned URL: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to generate upload URL"), nil
	}

	imageUrl := fmt.Sprintf("https://%s/%s/%s/%s.%s", h.cdnDomain, sellerID, imageID, filename, ext)
	resp := map[string]string{
		"uploadUrl": presignReq.URL,
		"imageUrl":  imageUrl,
	}

	return h.successResponse(resp), nil
}

// extractCustomerGroupIDs collects all customer group IDs from JWT configurations
// (one per company association). Used by catalog visibility filter.
func extractCustomerGroupIDs(userClaim map[string]interface{}) []string {
	configs, ok := userClaim["configurations"].([]interface{})
	if !ok {
		return nil
	}
	var ids []string
	for _, c := range configs {
		if cm, ok := c.(map[string]interface{}); ok {
			if gid, ok := cm["groupID"].(string); ok && gid != "" {
				ids = append(ids, gid)
			}
		}
	}
	return ids
}

// sanitizeGroupIDs trims, removes empty entries, dedupes.
// Format-only validation — no cross-service check (frontend ensures IDs match company groups).
// Returns nil for empty result so omitempty can drop the field.
func sanitizeGroupIDs(in []string) []string {
	if len(in) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(in))
	out := make([]string, 0, len(in))
	for _, id := range in {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// recomputeRating normalizes the rating sub-document: filters invalid reviews,
// recomputes count/average/distribution from the reviews array, and clamps
// per-review ratings to 1..5. Always runs server-side; clients can lie about
// aggregates but cannot poison the counts that drive Google Shopping stars.
// Also normalizes each review's date string to time.Time so subsequent reads
// decode cleanly into the storage.Review struct, and sets createdAt = now
// when missing.
func recomputeRating(rating map[string]interface{}) map[string]interface{} {
	reviews, _ := rating["reviews"].([]interface{})
	dist := map[string]int{"star1": 0, "star2": 0, "star3": 0, "star4": 0, "star5": 0}
	sum := 0
	count := 0
	now := time.Now()
	for _, r := range reviews {
		rev, ok := r.(map[string]interface{})
		if !ok {
			continue
		}
		var rv int
		switch v := rev["rating"].(type) {
		case float64:
			rv = int(v)
		case int:
			rv = v
		case int32:
			rv = int(v)
		}
		if rv < 1 || rv > 5 {
			continue
		}
		// Normalize date: frontend sends "2006-01-02" from a date input; mongo
		// driver cannot decode that string into time.Time on subsequent reads.
		// Accept either YYYY-MM-DD or RFC3339.
		if dateStr, ok := rev["date"].(string); ok && dateStr != "" {
			if t, err := time.Parse("2006-01-02", dateStr); err == nil {
				rev["date"] = t
			} else if t, err := time.Parse(time.RFC3339, dateStr); err == nil {
				rev["date"] = t
			}
		}
		if _, hasDate := rev["date"]; !hasDate {
			rev["date"] = now
		}
		// CreatedAt is system-managed: stamp once on first save.
		if _, hasCreated := rev["createdAt"]; !hasCreated {
			rev["createdAt"] = now
		}
		sum += rv
		count++
		dist[fmt.Sprintf("star%d", rv)]++
	}
	avg := 0.0
	if count > 0 {
		// Round to 1 decimal place without importing math: ×10, +0.5, truncate, /10
		avg = float64(int(float64(sum)/float64(count)*10+0.5)) / 10
	}
	rating["count"] = count
	rating["average"] = avg
	rating["distribution"] = dist
	return rating
}

func validatePriceTiers(tiers []storage.PriceTier) error {
	for i, t := range tiers {
		if i == 0 && t.MinQty < 2 {
			return fmt.Errorf("first price tier minQty must be >= 2 (base price covers qty 1)")
		} else if t.MinQty < 1 {
			return fmt.Errorf("price tier %d: minQty must be >= 1", i+1)
		}
		if t.Price <= 0 {
			return fmt.Errorf("price tier %d: price must be > 0", i+1)
		}
		if i > 0 && t.MinQty <= tiers[i-1].MinQty {
			return fmt.Errorf("price tiers must be sorted by ascending minQty (tier %d)", i+1)
		}
	}
	return nil
}

func (h *LambdaHandler) errorResponse(statusCode int, message string) events.APIGatewayProxyResponse {
	body, _ := json.Marshal(map[string]string{"message": message})
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(body),
	}
}

func (h *LambdaHandler) successResponse(data interface{}) events.APIGatewayProxyResponse {
	var body string
	if data != nil {
		jsonBody, err := json.Marshal(data)
		if err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to marshal response")
		}
		body = string(jsonBody)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       body,
	}
}

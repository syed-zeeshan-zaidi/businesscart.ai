package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
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

	// Route the request
	log.Printf("DEBUG [catalog-service]: Path=%s Method=%s", request.Path, request.HTTPMethod)
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

func (h *LambdaHandler) createProduct(userClaim map[string]interface{}, body string) (events.APIGatewayProxyResponse, error) {
	if userClaim["role"] != "company" && userClaim["role"] != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Company role required"), nil
	}

	var product storage.Product
	if err := json.Unmarshal([]byte(body), &product); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	if err := validate.Struct(product); err != nil {
		return h.errorResponse(http.StatusBadRequest, err.Error()), nil
	}

	product.SellerID = userClaim["id"].(string)

	if err := h.db.CreateProduct(&product); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create product"), nil
	}

	return h.successResponse(product), nil
}

func (h *LambdaHandler) getProducts(userClaim map[string]interface{}) (events.APIGatewayProxyResponse, error) {
	role := userClaim["role"].(string)
	accountID := userClaim["id"].(string)

	var filter bson.M
	switch role {
	case "admin":
		filter = bson.M{}
	case "company":
		filter = bson.M{"sellerID": accountID}
	case "customer", "b2c":
		associateCompanyIDs, ok := userClaim["associate_company_ids"].([]interface{})
		if !ok {
			// If associate_company_ids is not present, this customer can't see any products.
			return h.successResponse([]*storage.Product{}), nil
		}
		var companyIDs []string
		for _, id := range associateCompanyIDs {
			companyIDs = append(companyIDs, id.(string))
		}
		filter = bson.M{"sellerID": bson.M{"$in": companyIDs}}
	default:
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Invalid role"), nil
	}

	products, err := h.db.GetProducts(filter)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to retrieve products"), nil
	}

	if len(products) == 0 {
		return h.successResponse([]*storage.Product{}), nil
	}

	if role == "customer" || role == "b2c" {
		if customerConfigs, ok := userClaim["configurations"].([]interface{}); ok {
			discountMap := make(map[string]float64)
			for _, config := range customerConfigs {
				if configMap, ok := config.(map[string]interface{}); ok {
					companyID, _ := configMap["company_id"].(string)
					if discount, ok := configMap["discount"].(float64); ok && companyID != "" {
						discountMap[companyID] = discount
					}
				}
			}

			for _, product := range products {
				if discount, ok := discountMap[product.SellerID]; ok {
					product.DiscountedPrice = product.Price * (1 - discount/100)
				}
			}
		}
	}

	return h.successResponse(products), nil
}

func (h *LambdaHandler) getProductByID(userClaim map[string]interface{}, idStr string) (events.APIGatewayProxyResponse, error) {
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Product not found"), nil
	}

	// Authorization check for non-admin roles
	if userClaim["role"] != "admin" {
		isOwner := product.SellerID == userClaim["id"].(string)

		isAssociatedCustomer := false
		if userClaim["role"] == "customer" || userClaim["role"] == "b2c" {
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
	}

	return h.successResponse(product), nil
}

func (h *LambdaHandler) updateProduct(userClaim map[string]interface{}, idStr string, body string) (events.APIGatewayProxyResponse, error) {
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Product not found"), nil
	}

	if product.SellerID != userClaim["id"].(string) && userClaim["role"] != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized to update this product"), nil
	}

	var updates bson.M
	if err := json.Unmarshal([]byte(body), &updates); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	// Prevent updating SellerID
	delete(updates, "sellerID")

	if err := h.db.UpdateProduct(id, updates); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to update product"), nil
	}

	return h.successResponse(nil), nil
}

func (h *LambdaHandler) deleteProduct(userClaim map[string]interface{}, idStr string) (events.APIGatewayProxyResponse, error) {
	id, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid ID"), nil
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Product not found"), nil
	}

	if product.SellerID != userClaim["id"].(string) && userClaim["role"] != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized to delete this product"), nil
	}

	if err := h.db.DeleteProduct(id); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to delete product"), nil
	}

	return h.successResponse(nil), nil
}

// --- Image Upload Endpoints ---

func (h *LambdaHandler) getUploadURL(userClaim map[string]interface{}, body string) (events.APIGatewayProxyResponse, error) {
	if userClaim["role"] != "company" && userClaim["role"] != "admin" {
		return h.errorResponse(http.StatusForbidden, "Unauthorized: Company role required"), nil
	}

	if h.s3Client == nil || h.s3Bucket == "" {
		return h.errorResponse(http.StatusServiceUnavailable, "Image upload not configured"), nil
	}

	var req struct {
		ContentType   string `json:"contentType"`
		FileExtension string `json:"fileExtension"`
	}
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	if req.ContentType == "" || req.FileExtension == "" {
		return h.errorResponse(http.StatusBadRequest, "contentType and fileExtension are required"), nil
	}

	sellerID := userClaim["id"].(string)
	imageID := uuid.New().String()
	ext := req.FileExtension
	key := fmt.Sprintf("%s/%s/image.%s", sellerID, imageID, ext)

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

	imageUrl := fmt.Sprintf("https://%s/%s/%s/image.%s", h.cdnDomain, sellerID, imageID, ext)
	resp := map[string]string{
		"uploadUrl": presignReq.URL,
		"imageUrl":  imageUrl,
	}

	return h.successResponse(resp), nil
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

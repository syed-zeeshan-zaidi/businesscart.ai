package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/golang-jwt/jwt/v5"
	"github.com/syed/businesscart/checkout-service/internal/cart"
	"github.com/syed/businesscart/checkout-service/internal/order"
	"github.com/syed/businesscart/checkout-service/internal/payment"
	"github.com/syed/businesscart/checkout-service/internal/quote"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CheckoutRequest represents the request body for a checkout.
type CheckoutRequest struct {
	CompanyID    string          `json:"companyId"`
	PromoCode    string          `json:"promoCode,omitempty"`
	PaymentToken string          `json:"paymentToken"`
	Items        []cart.CartItem `json:"items"`
}

// CartItemRequest represents the request body for adding/updating a cart item.
type CartItemRequest struct {
	Entity cart.CartItem `json:"entity"`
}

// CustomerConfiguration represents a customer-specific configuration.
type CustomerConfiguration struct {
	CompanyID          string   `json:"company_id"`
	DiscountPercentage *float64 `json:"discount,omitempty"`
	PaymentMethods     []string `json:"paymentMethods,omitempty"`
	DeliveryMethods    []string `json:"deliveryMethods,omitempty"`
	ShippingOutOptions []string `json:"shippingOutOptions,omitempty"`
	QuotesAllowed      *bool    `json:"quotesAllowed,omitempty"`
}

// PatchRequest defines the structure for all PATCH operations
type PatchRequest struct {
	Operation string          `json:"operation"`
	Value     json.RawMessage `json:"value"`
}

// LambdaHandler handles AWS Lambda requests.
type LambdaHandler struct {
	requestOrigin  string
	cartService    *cart.Service
	quoteService   *quote.Service
	orderService   *order.Service
	paymentService *payment.PaymentService
	jwtSecret      string
}

// NewLambdaHandler creates a new LambdaHandler.
func NewLambdaHandler(cartService *cart.Service, quoteService *quote.Service, orderService *order.Service, paymentService *payment.PaymentService, jwtSecret string) *LambdaHandler {
	return &LambdaHandler{
		cartService:    cartService,
		quoteService:   quoteService,
		orderService:   orderService,
		paymentService: paymentService,
		jwtSecret:      jwtSecret,
	}
}

// HandleRequest processes an API Gateway Proxy Request.
func (h *LambdaHandler) HandleRequest(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	h.requestOrigin = request.Headers["origin"]
	if h.requestOrigin == "" {
		h.requestOrigin = request.Headers["Origin"]
	}

	// Handle preflight OPTIONS requests
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers:    corsHeaders(h.requestOrigin),
		}, nil
	}

	log.Printf("Received event: %+v", request)

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

	userClaim, ok := claims["user"].(map[string]interface{})
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: User claim is not a map"), nil
	}

	accountID, ok := userClaim["id"].(string)
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: User ID missing"), nil
	}

	role, ok := userClaim["role"].(string)
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: Role missing"), nil
	}

	// Add this block to safely extract associate_company_ids
	var associateCompanyIDs []string
	if ids, ok := userClaim["associate_company_ids"].([]interface{}); ok {
		for _, id := range ids {
			if idStr, ok := id.(string); ok {
				associateCompanyIDs = append(associateCompanyIDs, idStr)
			}
		}
	}

	// Add this block to safely extract configurations
	var configurations []CustomerConfiguration
	if configs, ok := userClaim["configurations"].([]interface{}); ok {
		for _, config := range configs {
			if configMap, ok := config.(map[string]interface{}); ok {
				var customerConfig CustomerConfiguration
				if companyID, ok := configMap["company_id"].(string); ok {
					customerConfig.CompanyID = companyID
				}
				if discount, ok := configMap["discount"].(float64); ok {
					customerConfig.DiscountPercentage = &discount
				}
				if pms, ok := configMap["paymentMethods"].([]interface{}); ok {
					for _, pm := range pms {
						if pmStr, ok := pm.(string); ok {
							customerConfig.PaymentMethods = append(customerConfig.PaymentMethods, pmStr)
						}
					}
				}
				if dms, ok := configMap["deliveryMethods"].([]interface{}); ok {
					for _, dm := range dms {
						if dmStr, ok := dm.(string); ok {
							customerConfig.DeliveryMethods = append(customerConfig.DeliveryMethods, dmStr)
						}
					}
				}
				if sos, ok := configMap["shippingOutOptions"].([]interface{}); ok {
					for _, so := range sos {
						if soStr, ok := so.(string); ok {
							customerConfig.ShippingOutOptions = append(customerConfig.ShippingOutOptions, soStr)
						}
					}
				}
				configurations = append(configurations, customerConfig)
			}
		}
	}

	log.Printf("Account ID: %s, Role: %s, Associate Company IDs: %v", accountID, role, associateCompanyIDs)

	if strings.HasPrefix(request.Path, "/checkout/cart") {
		return h.handleCartRequest(request, accountID, role, associateCompanyIDs)
	} else if strings.HasPrefix(request.Path, "/checkout/quotes") {
		return h.handleQuoteRequest(request, accountID, role, configurations)
	} else if strings.HasPrefix(request.Path, "/checkout/orders") {
		return h.handleOrderRequest(request, accountID, role)
	}

	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

func (h *LambdaHandler) handleOrderRequest(request events.APIGatewayProxyRequest, accountID string, role string) (events.APIGatewayProxyResponse, error) {
	if request.HTTPMethod == "POST" {
		return h.handlePlaceOrderRequest(request, accountID)
	}
	if request.HTTPMethod == "GET" {
		return h.handleGetOrdersRequest(request, accountID, role)
	}
	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

func (h *LambdaHandler) handleQuoteRequest(request events.APIGatewayProxyRequest, accountID string, role string, configurations []CustomerConfiguration) (events.APIGatewayProxyResponse, error) {
	parts := strings.Split(request.Path, "/")
	if request.HTTPMethod == "POST" {
		return h.handleCreateQuoteRequest(request, accountID, role, configurations)
	}
	if request.HTTPMethod == "GET" {
		if len(parts) == 3 { // /checkout/quotes
			return h.handleGetMyQuotesRequest(request, accountID, role)
		}
		if len(parts) == 4 { // /checkout/quotes/{quoteId}
			quoteId := parts[3]
			return h.handleGetQuoteRequest(request, accountID, role, quoteId)
		}
	}
	if request.HTTPMethod == "PATCH" {
		if len(parts) == 4 { // /checkout/quotes/{quoteId}
			quoteId := parts[3]
			return h.handlePatchQuoteRequest(request, accountID, role, quoteId)
		}
	}
	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

// applyDiscountRequest defines the structure for applying a discount to a quote.
type applyDiscountRequest struct {
	DiscountPercentage float64 `json:"discountPercentage"`
}

// sellerUpdateRequest defines the structure for a seller updating a quote.
type sellerUpdateRequest struct {
	Items           []quote.ItemUpdate `json:"items,omitempty"`
	NewShippingCost *float64           `json:"newShippingCost,omitempty"`
	Notes           *string            `json:"notes,omitempty"`
}

// customerProposeRequest defines the structure for a customer proposing changes to a quote.
type customerProposeRequest struct {
	Changes []quote.ProposedChange `json:"changes"`
}

// updateStatusRequest defines the structure for updating a quote's status.
type updateStatusRequest struct {
	Status string `json:"status"`
}

func (h *LambdaHandler) handlePatchQuoteRequest(request events.APIGatewayProxyRequest, accountID string, role string, quoteIdStr string) (events.APIGatewayProxyResponse, error) {
	quoteID, err := primitive.ObjectIDFromHex(quoteIdStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid quote ID"), nil
	}

	var patch PatchRequest
	if err := json.Unmarshal([]byte(request.Body), &patch); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body\n"+err.Error()), nil
	}

	var updatedQuote *quote.Quote

	switch patch.Operation {
	case "addComment":
		var commentData struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(patch.Value, &commentData); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid comment data"), nil
		}
		updatedQuote, err = h.quoteService.AddComment(quoteID, accountID, commentData.Text)
	case "applyDiscount":
		if role != "company" && role != "admin" {
			return h.errorResponse(http.StatusForbidden, "Forbidden: Only company or admin can apply discounts"), nil
		}
		var discountData applyDiscountRequest
		if err := json.Unmarshal(patch.Value, &discountData); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid discount data"), nil
		}
		updatedQuote, err = h.quoteService.ApplyQuoteDiscount(quoteID, discountData.DiscountPercentage, accountID)
	case "sellerUpdate":
		if role != "company" && role != "admin" {
			return h.errorResponse(http.StatusForbidden, "Forbidden: Only company or admin can update quote as seller"), nil
		}
		var sellerUpdateData sellerUpdateRequest
		if err := json.Unmarshal(patch.Value, &sellerUpdateData); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid seller update data"), nil
		}
		updatedQuote, err = h.quoteService.UpdateQuoteBySeller(quoteID, quote.SellerUpdate{
			Items:           sellerUpdateData.Items,
			NewShippingCost: sellerUpdateData.NewShippingCost,
			Notes:           sellerUpdateData.Notes,
		}, accountID)
	case "customerPropose":
		if role != "customer" && role != "b2c" && role != "admin" {
			return h.errorResponse(http.StatusForbidden, "Forbidden: Only customer or admin can propose changes"), nil
		}
		var customerProposeData customerProposeRequest
		if err := json.Unmarshal(patch.Value, &customerProposeData); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid customer propose data"), nil
		}
		updatedQuote, err = h.quoteService.CustomerPropose(quoteID, customerProposeData.Changes)
	case "updateStatus":
		if role != "company" && role != "admin" {
			return h.errorResponse(http.StatusForbidden, "Forbidden: Only company or admin can update quote status"), nil
		}
		var statusData updateStatusRequest
		if err := json.Unmarshal(patch.Value, &statusData); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid status data"), nil
		}
		updatedQuote, err = h.quoteService.UpdateQuoteStatus(quoteID, statusData.Status)
	default:
		return h.errorResponse(http.StatusBadRequest, "Invalid patch operation"), nil
	}

	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to perform patch operation: "+err.Error()), nil
	}

	return h.successResponse(updatedQuote), nil
}

func (h *LambdaHandler) handleGetMyQuotesRequest(request events.APIGatewayProxyRequest, accountID string, role string) (events.APIGatewayProxyResponse, error) {
	log.Printf("handleGetMyQuotesRequest: accountID=%s, role=%s", accountID, role)
	var quotes []quote.Quote
	var err error

	sellerID := request.QueryStringParameters["sellerId"]

	if role == "customer" || role == "b2c" {
		quotes, err = h.quoteService.GetQuotesByAccountID(context.Background(), accountID, sellerID)
	} else if role == "company" {
		quotes, err = h.quoteService.GetQuotesBySellerID(context.Background(), accountID)
	} else if role == "admin" {
		quotes, err = h.quoteService.GetQuotesBySellerID(context.Background(), sellerID)
	} else {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}

	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to retrieve quotes"), nil
	}

	respBody, _ := json.Marshal(quotes)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}, nil
}

func (h *LambdaHandler) handleGetQuoteRequest(request events.APIGatewayProxyRequest, accountID string, role string, quoteIdStr string) (events.APIGatewayProxyResponse, error) {
	quoteID, err := primitive.ObjectIDFromHex(quoteIdStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid quote ID"), nil
	}

	quote, err := h.quoteService.GetQuote(quoteID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Quote not found"), nil
	}

	// Authorization logic
	isOwner := quote.AccountID == accountID
	isSeller := quote.SellerID == accountID

	switch role {
	case "customer", "b2c":
		if !isOwner {
			return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
		}
	case "company":
		if !isSeller {
			return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
		}
	case "admin":
		// Admin can access any quote
	default:
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}

	respBody, _ := json.Marshal(quote)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}, nil
}

func (h *LambdaHandler) handlePlaceOrderRequest(request events.APIGatewayProxyRequest, accountID string) (events.APIGatewayProxyResponse, error) {
	var req struct {
		QuoteID           string `json:"quoteId"`
		PaymentMethod     string `json:"paymentMethod"`
		PaymentToken      string `json:"paymentToken"`
		PickupLocationID  string `json:"pickupLocationId,omitempty"`
		DeliveryAddressID string `json:"deliveryAddressId,omitempty"`
		DeliveryMethod    string `json:"deliveryMethod"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	quoteID, err := primitive.ObjectIDFromHex(req.QuoteID)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid quote ID"), nil
	}

	quote, err := h.quoteService.GetQuote(quoteID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Quote not found"), nil
	}

	// Ensure the quote is approved before placing an order
	if quote.Status != "approved" {
		return h.errorResponse(http.StatusForbidden, "Quote is not approved for order placement"), nil
	}

	// Process payment
	transactionID, ok := h.paymentService.ProcessPayment(quote.GrandTotal, req.PaymentMethod, req.PaymentToken)
	if !ok {
		return h.errorResponse(http.StatusPaymentRequired, "Payment failed"), nil
	}

	newOrder := &order.Order{
		ID:                primitive.NewObjectID(),
		QuoteID:           quote.ID,
		AccountID:         accountID,
		SellerID:          quote.SellerID,
		Items:             quote.Items,
		Subtotal:          quote.Subtotal,
		ShippingCost:      quote.ShippingCost,
		TaxAmount:         quote.TaxAmount,
		GrandTotal:        quote.GrandTotal,
		PaymentMethod:     req.PaymentMethod,
		DeliveryMethod:    req.DeliveryMethod,
		TransactionID:     transactionID,
		PickupLocationID:  req.PickupLocationID,
		DeliveryAddressID: req.DeliveryAddressID,
	}

	createdOrder, err := h.orderService.CreateOrder(newOrder)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create order"), nil
	}

	// Clean up cart and quote
	_ = h.cartService.ClearCart(accountID, quote.SellerID)
	if quote.QuoteType == "negotiable" {
		_, err = h.quoteService.UpdateQuoteStatus(quote.ID, "ordered")
		if err != nil {
			log.Printf("Failed to update quote status to ordered: %v", err)
		}
	} else {
		_ = h.quoteService.DeleteQuote(req.QuoteID)
	}

	respBody, _ := json.Marshal(createdOrder)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}, nil
}

func (h *LambdaHandler) handleGetOrdersRequest(request events.APIGatewayProxyRequest, accountID string, role string) (events.APIGatewayProxyResponse, error) {
	var sellerID string
	if role == "company" {
		sellerID = accountID
	}
	orders, err := h.orderService.GetOrders(accountID, role, sellerID)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to get orders"), nil
	}

	respBody, _ := json.Marshal(orders)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}, nil
}

func (h *LambdaHandler) handleCreateQuoteRequest(request events.APIGatewayProxyRequest, accountID string, role string, configurations []CustomerConfiguration) (events.APIGatewayProxyResponse, error) {
	var req struct {
		CartID             string                  `json:"cartId"`
		SellerID           string                  `json:"sellerId"`
		AccountID          string                  `json:"accountId"` // This is the customer ID for whom the quote is created
		PaymentMethods     []string                `json:"paymentMethods"`
		DeliveryMethods    []string                `json:"deliveryMethods"`
		ShippingOutOptions []string                `json:"shippingOutOptions"`
		CompanyLocations   []quote.CompanyLocation `json:"companyLocations"`
		CustomerAddresses  []quote.CustomerAddress `json:"customerAddresses"`
		QuoteType          string                  `json:"quoteType"` // New field
		QuotesAllowed      bool                    `json:"quotesAllowed"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	// Determine the effective AccountID for cart retrieval and quote creation
	// If the caller is a company or admin, and an accountID is provided in the request body,
	// use that accountID. Otherwise, use the accountID from the JWT (the caller's ID).
	effectiveAccountID := accountID
	if (role == "company" || role == "admin") && req.AccountID != "" {
		// Authorization check: A company can only create a quote for a customer associated with it.
		// This would typically involve a lookup in the account service to verify the association.
		// For now, we'll assume the frontend sends a valid associated customer ID.
		if role == "company" && req.SellerID != accountID {
			return h.errorResponse(http.StatusForbidden, "Forbidden: Company can only create quotes for its own customers."), nil
		}
		effectiveAccountID = req.AccountID
	}

	// Check for customer-specific configuration
	effectiveQuotesAllowed := req.QuotesAllowed
	for _, config := range configurations {
		if config.CompanyID == req.SellerID {
			if config.PaymentMethods != nil {
				req.PaymentMethods = config.PaymentMethods
			}
			if config.DeliveryMethods != nil {
				req.DeliveryMethods = config.DeliveryMethods
			}
			if config.ShippingOutOptions != nil {
				req.ShippingOutOptions = config.ShippingOutOptions
			}
			if config.QuotesAllowed != nil {
				effectiveQuotesAllowed = *config.QuotesAllowed
			}
			break
		}
	}

	if !effectiveQuotesAllowed && req.QuoteType == "negotiable" {
		return h.errorResponse(http.StatusForbidden, "This company does not allow quote requests."), nil
	}

	cart, err := h.cartService.GetCart(effectiveAccountID, req.SellerID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Cart not found"), nil
	}

	if len(cart.Items) == 0 {
		return h.errorResponse(http.StatusBadRequest, "Cart is empty"), nil
	}

	// Simple tax and shipping calculation (placeholders)
	taxAmount := cart.TotalPrice * 0.0825 // 8.25% tax
	shippingCost := 10.00                 // Flat rate shipping

	initialStatus := "draft" // Default for negotiable
	if req.QuoteType == "standard" {
		initialStatus = "approved"
	}

	newQuote := &quote.Quote{
		CartID:                      cart.ID,
		AccountID:                   effectiveAccountID,
		SellerID:                    req.SellerID,
		Items:                       cart.Items,
		Subtotal:                    cart.TotalPrice,
		ShippingCost:                shippingCost,
		TaxAmount:                   taxAmount,
		GrandTotal:                  cart.TotalPrice + shippingCost + taxAmount,
		AvailablePaymentMethods:     req.PaymentMethods,
		AvailableDeliveryMethods:    req.DeliveryMethods,
		AvailableShippingOutOptions: req.ShippingOutOptions,
		CompanyLocations:            req.CompanyLocations,
		CustomerAddresses:           req.CustomerAddresses,
		QuoteType:                   req.QuoteType, // Assign the new field
		Status:                      initialStatus, // Set initial status dynamically
	}

	createdQuote, err := h.quoteService.CreateQuote(newQuote)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create or update quote"), nil
	}

	respBody, _ := json.Marshal(createdQuote)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}, nil
}

func (h *LambdaHandler) handleCartRequest(request events.APIGatewayProxyRequest, accountID string, role string, associateCompanyIDs []string) (events.APIGatewayProxyResponse, error) {
	headers := corsHeaders(h.requestOrigin)

	effectiveAccountID := accountID
	// For company/admin roles, allow specifying a customer account ID
	if role == "company" || role == "admin" {
		if customerAccountID, ok := request.QueryStringParameters["accountId"]; ok && customerAccountID != "" {
			effectiveAccountID = customerAccountID
			// Optional: Add authorization check here to ensure the company is allowed to modify this customer's cart.
		}
	}
	log.Printf("handleCartRequest: effectiveAccountID=%s, role=%s", effectiveAccountID, role)

	switch request.HTTPMethod {
	case "POST": // Add item to cart
		var req CartItemRequest
		if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
		}
		currentCart, err := h.cartService.GetCart(effectiveAccountID, req.Entity.SellerID)
		if err != nil && err.Error() != "cart not found" {
			return h.errorResponse(http.StatusInternalServerError, "Failed to get cart"), nil
		}
		if currentCart == nil {
			currentCart = &cart.Cart{
				AccountID: effectiveAccountID,
				SellerID:  req.Entity.SellerID,
				Items:     []cart.CartItem{},
			}
		}

		found := false
		for i, item := range currentCart.Items {
			if item.ProductID == req.Entity.ProductID && item.SellerID == req.Entity.SellerID {
				currentCart.Items[i].Quantity += req.Entity.Quantity
				found = true
				break
			}
		}
		if !found {
			req.Entity.ID = primitive.NewObjectID() // Assign a new ObjectID for the new item
			currentCart.Items = append(currentCart.Items, req.Entity)
		}

		if err := h.cartService.SaveCart(currentCart); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to save cart"), nil
		}
		respBody, _ := json.Marshal(currentCart)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers:    headers,
			Body:       string(respBody),
		}, nil

	case "GET": // Get cart
		sellerID := request.QueryStringParameters["sellerId"]
		if sellerID == "" {
			return h.errorResponse(http.StatusBadRequest, "Seller ID is required"), nil
		}

		// Authorization check for customer role
		if role == "customer" || role == "b2c" {
			can_access := false
			for _, id := range associateCompanyIDs {
				if id == sellerID {
					can_access = true
					break
				}
			}
			if !can_access {
				return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
			}
		}

		fetchedCart, err := h.cartService.GetCart(effectiveAccountID, sellerID)
		if err != nil {
			if err.Error() == "cart not found" {
				// Return an empty cart if not found, as per previous cart-service behavior
				emptyCart := cart.Cart{AccountID: effectiveAccountID, SellerID: sellerID, Items: []cart.CartItem{}, TotalPrice: 0}
				respBody, _ := json.Marshal(emptyCart)
				return events.APIGatewayProxyResponse{
					StatusCode: http.StatusOK,
					Headers:    headers,
					Body:       string(respBody),
				}, nil
			}
			return h.errorResponse(http.StatusInternalServerError, "Failed to get cart"), nil
		}
		respBody, _ := json.Marshal(fetchedCart)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers:    headers,
			Body:       string(respBody),
		}, nil

	case "PUT": // Update item quantity
		itemId := request.PathParameters["itemId"]
		sellerID := request.QueryStringParameters["sellerId"]
		if itemId == "" || sellerID == "" {
			return h.errorResponse(http.StatusBadRequest, "Item ID and Seller ID are required"), nil
		}
		var req CartItemRequest
		if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
		}

		objID, err := primitive.ObjectIDFromHex(itemId)
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid item ID format"), nil
		}

		currentCart, err := h.cartService.GetCart(effectiveAccountID, sellerID)
		if err != nil {
			return h.errorResponse(http.StatusNotFound, "Cart not found"), nil
		}

		found := false
		for i, item := range currentCart.Items {
			if item.ID == objID {
				currentCart.Items[i].Quantity = req.Entity.Quantity
				found = true
				break
			}
		}
		if !found {
			return h.errorResponse(http.StatusNotFound, "Item not found in cart"), nil
		}

		if err := h.cartService.SaveCart(currentCart); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to update cart item"), nil
		}
		respBody, _ := json.Marshal(currentCart)
		return events.APIGatewayProxyResponse{
				StatusCode: http.StatusOK,
				Headers:    headers,
				Body:       string(respBody),
			},
			nil

	case "DELETE": // Remove item or clear cart
		itemId, hasItemId := request.PathParameters["itemId"]

		if hasItemId && itemId != "" { // Remove specific item
			sellerID := request.QueryStringParameters["sellerId"]
			if sellerID == "" {
				return h.errorResponse(http.StatusBadRequest, "Seller ID is required"), nil
			}

			objID, err := primitive.ObjectIDFromHex(itemId)
			if err != nil {
				return h.errorResponse(http.StatusBadRequest, "Invalid item ID format"), nil
			}

			currentCart, err := h.cartService.GetCart(effectiveAccountID, sellerID)
			if err != nil {
				return h.errorResponse(http.StatusNotFound, "Cart not found"), nil
			}

			newItems := []cart.CartItem{}
			found := false
			for _, item := range currentCart.Items {
				if item.ID != objID {
					newItems = append(newItems, item)
				} else {
					found = true
				}
			}
			if !found {
				return h.errorResponse(http.StatusNotFound, "Item not found in cart"), nil
			}
			currentCart.Items = newItems

			if err := h.cartService.SaveCart(currentCart); err != nil {
				return h.errorResponse(http.StatusInternalServerError, "Failed to remove cart item"), nil
			}
			respBody, _ := json.Marshal(currentCart)
			return events.APIGatewayProxyResponse{
					StatusCode: http.StatusOK,
					Headers:    headers,
					Body:       string(respBody),
				},
				nil

		} else if request.Path == "/checkout/cart" { // Clear entire cart
			sellerID := request.QueryStringParameters["sellerId"]
			if sellerID == "" {
				return h.errorResponse(http.StatusBadRequest, "Seller ID is required"), nil
			}
			if err := h.cartService.ClearCart(effectiveAccountID, sellerID); err != nil {
				return h.errorResponse(http.StatusInternalServerError, "Failed to clear cart"), nil
			}
			emptyCart := cart.Cart{AccountID: effectiveAccountID, SellerID: sellerID, Items: []cart.CartItem{}, TotalPrice: 0}
			respBody, _ := json.Marshal(emptyCart)
			return events.APIGatewayProxyResponse{
					StatusCode: http.StatusOK,
					Headers:    headers,
					Body:       string(respBody),
				},
				nil
		}
		return h.errorResponse(http.StatusBadRequest, "Invalid cart delete request"), nil

	default:
		return h.errorResponse(http.StatusMethodNotAllowed, "Method not allowed"), nil
	}
}

func (h *LambdaHandler) errorResponse(statusCode int, message string) events.APIGatewayProxyResponse {
	respBody, _ := json.Marshal(map[string]string{"message": message})
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}
}

func (h *LambdaHandler) successResponse(data interface{}) events.APIGatewayProxyResponse {
	respBody, _ := json.Marshal(data)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}
}

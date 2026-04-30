package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/golang-jwt/jwt/v5"
	"github.com/syed/businesscart/checkout-service/internal/cart"
	mailer "github.com/syed/businesscart/checkout-service/internal/email"
	"github.com/syed/businesscart/checkout-service/internal/gateway"
	"github.com/syed/businesscart/checkout-service/internal/order"
	"github.com/syed/businesscart/checkout-service/internal/quote"
	"github.com/syed/businesscart/checkout-service/internal/statement"
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
	CompanyID             string   `json:"company_id"`
	DiscountPercentage    *float64 `json:"discount,omitempty"`
	PaymentMethods        []string `json:"paymentMethods,omitempty"`
	DeliveryMethods       []string `json:"deliveryMethods,omitempty"`
	ShippingOutOptions    []string `json:"shippingOutOptions,omitempty"`
	QuotesAllowed         *bool    `json:"quotesAllowed,omitempty"`
	CreditLimit           *float64 `json:"creditLimit,omitempty"`
	MinOrderAmountLimit   *float64 `json:"minOrderAmountLimit,omitempty"`
	MaxOrderAmountLimit   *float64 `json:"maxOrderAmountLimit,omitempty"`
	MinOrderQuantityLimit *float64 `json:"minOrderQuantityLimit,omitempty"`
	MaxOrderQuantityLimit *float64 `json:"maxOrderQuantityLimit,omitempty"`
	MonthlyOrderLimit     *float64 `json:"monthlyOrderLimit,omitempty"`
	YearlyOrderLimit      *float64 `json:"yearlyOrderLimit,omitempty"`
	TaxableGoods          *bool    `json:"taxableGoods,omitempty"`
	TaxRate               *float64 `json:"taxRate,omitempty"`
	ShippingRate          *float64 `json:"shippingRate,omitempty"`
	LeadTime              *float64 `json:"leadTime,omitempty"`
}

// PatchRequest defines the structure for all PATCH operations
type PatchRequest struct {
	Operation string          `json:"operation"`
	Value     json.RawMessage `json:"value"`
}

// LambdaHandler handles AWS Lambda requests.
type LambdaHandler struct {
	requestOrigin    string
	requestUserEmail string // set per-request from JWT
	cartService      *cart.Service
	quoteService     *quote.Service
	orderService     *order.Service
	statementService *statement.Service
	gatewayStore     *gateway.Store
	gatewayRegistry  *gateway.Registry
	jwtSecret        string
	apiBaseURL       string
	emailSender      mailer.Sender
}

// NewLambdaHandler creates a new LambdaHandler.
func NewLambdaHandler(cartService *cart.Service, quoteService *quote.Service, orderService *order.Service, statementService *statement.Service, gatewayStore *gateway.Store, gatewayRegistry *gateway.Registry, jwtSecret, apiBaseURL string, emailSender mailer.Sender) *LambdaHandler {
	return &LambdaHandler{
		cartService:      cartService,
		quoteService:     quoteService,
		orderService:     orderService,
		statementService: statementService,
		gatewayStore:     gatewayStore,
		gatewayRegistry:  gatewayRegistry,
		jwtSecret:        jwtSecret,
		apiBaseURL:       apiBaseURL,
		emailSender:      emailSender,
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

	// Handle payment endpoints BEFORE JWT validation (browser redirects, no auth)
	if strings.HasPrefix(request.Path, "/checkout/payment-return") {
		return h.handlePaymentReturnRequest(request)
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

	// Capture email for outbound notifications. Optional — not all tokens have it.
	h.requestUserEmail, _ = userClaim["email"].(string)

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
				if qa, ok := configMap["quotesAllowed"].(bool); ok {
					customerConfig.QuotesAllowed = &qa
				}
				if v, ok := configMap["creditLimit"].(float64); ok {
					customerConfig.CreditLimit = &v
				}
				if v, ok := configMap["minOrderAmountLimit"].(float64); ok {
					customerConfig.MinOrderAmountLimit = &v
				}
				if v, ok := configMap["maxOrderAmountLimit"].(float64); ok {
					customerConfig.MaxOrderAmountLimit = &v
				}
				if v, ok := configMap["minOrderQuantityLimit"].(float64); ok {
					customerConfig.MinOrderQuantityLimit = &v
				}
				if v, ok := configMap["maxOrderQuantityLimit"].(float64); ok {
					customerConfig.MaxOrderQuantityLimit = &v
				}
				if v, ok := configMap["monthlyOrderLimit"].(float64); ok {
					customerConfig.MonthlyOrderLimit = &v
				}
				if v, ok := configMap["yearlyOrderLimit"].(float64); ok {
					customerConfig.YearlyOrderLimit = &v
				}
				if v, ok := configMap["taxableGoods"].(bool); ok {
					customerConfig.TaxableGoods = &v
				}
				if v, ok := configMap["taxRate"].(float64); ok {
					customerConfig.TaxRate = &v
				}
				if v, ok := configMap["shippingRate"].(float64); ok {
					customerConfig.ShippingRate = &v
				}
				if v, ok := configMap["leadTime"].(float64); ok {
					customerConfig.LeadTime = &v
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
	} else if strings.HasPrefix(request.Path, "/checkout/statements") {
		return h.handleStatementsRequest(request, accountID, role)
	} else if strings.HasPrefix(request.Path, "/checkout/gateways") {
		return h.handleGatewayRequest(request, accountID, role)
	}

	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

func (h *LambdaHandler) handleOrderRequest(request events.APIGatewayProxyRequest, accountID string, role string) (events.APIGatewayProxyResponse, error) {
	parts := strings.Split(request.Path, "/")
	if request.HTTPMethod == "GET" && len(parts) == 4 && parts[3] == "statement" {
		return h.handleGetStatementRequest(request, accountID, role)
	}
	if request.HTTPMethod == "POST" && len(parts) == 5 && parts[3] == "statement" && parts[4] == "send" {
		return h.handleSendStatementRequest(request, accountID, role)
	}
	// Guard: any other request under /statement is a client mistake — refuse
	// rather than fall through to handlePlaceOrderRequest (which would parse
	// the body as an order checkout).
	if len(parts) >= 4 && parts[3] == "statement" {
		return h.errorResponse(http.StatusMethodNotAllowed, "Use GET /checkout/orders/statement or POST /checkout/orders/statement/send"), nil
	}
	if request.HTTPMethod == "POST" {
		return h.handlePlaceOrderRequest(request, accountID)
	}
	if request.HTTPMethod == "GET" {
		return h.handleGetOrdersRequest(request, accountID, role)
	}
	if request.HTTPMethod == "DELETE" && len(parts) == 4 { // /checkout/orders/{orderId}
		return h.handleDeleteOrderRequest(parts[3], role)
	}
	if request.HTTPMethod == "PUT" && len(parts) == 4 { // /checkout/orders/{orderId}
		return h.handleUpdateOrderRequest(parts[3], request, accountID, role)
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
		PickupLocationID  string `json:"pickupLocationId,omitempty"`
		DeliveryAddressID string `json:"deliveryAddressId,omitempty"`
		DeliveryMethod    string `json:"deliveryMethod"`
		ReturnURL         string `json:"returnUrl,omitempty"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	quoteID, err := primitive.ObjectIDFromHex(req.QuoteID)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid quote ID"), nil
	}

	q, err := h.quoteService.GetQuote(quoteID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Quote not found"), nil
	}

	if q.AccountID != accountID {
		return h.errorResponse(http.StatusForbidden, "You do not own this quote"), nil
	}

	if q.Status != "approved" {
		return h.errorResponse(http.StatusForbidden, "Quote is not approved for order placement"), nil
	}

	if h.gatewayStore == nil {
		return h.errorResponse(http.StatusServiceUnavailable, "Payment gateway service not configured"), nil
	}

	ctx := context.Background()

	// Look up gateway — first check seller-specific config, then fall back to registry (offline methods)
	gatewayConfig, gwErr := h.gatewayStore.GetConfig(ctx, q.SellerID, req.PaymentMethod)

	gw, gwRegistered := h.gatewayRegistry.Get(req.PaymentMethod)
	if !gwRegistered {
		return h.errorResponse(http.StatusBadRequest, "Unsupported payment method: "+req.PaymentMethod), nil
	}

	// Determine which credentials to use (sandbox vs production)
	var credentials map[string]string
	var sandbox bool
	if gwErr == nil && gatewayConfig != nil {
		sandbox = gatewayConfig.Sandbox
		if sandbox {
			credentials = gatewayConfig.SandboxCredentials
			if len(credentials) == 0 {
				return h.errorResponse(http.StatusBadRequest, "Sandbox credentials not configured for "+req.PaymentMethod), nil
			}
		} else {
			credentials = gatewayConfig.Credentials
			if len(credentials) == 0 {
				return h.errorResponse(http.StatusBadRequest, "Production credentials not configured for "+req.PaymentMethod), nil
			}
		}
	}

	callbackURL := h.apiBaseURL + "/checkout/payment-return"
	sessionReq := gateway.SessionRequest{
		Amount:        q.GrandTotal,
		Currency:      "USD",
		CallbackURL:   callbackURL,
		Credentials:   credentials,
		MerchantRef:   q.ID.Hex(),
		Sandbox:       sandbox,
		CustomerEmail: h.requestUserEmail,
	}

	sessionResp, err := gw.CreateSession(ctx, sessionReq)
	if err != nil {
		log.Printf("Gateway CreateSession failed for %s: %v", req.PaymentMethod, err)
		return h.errorResponse(http.StatusInternalServerError, "Payment processing failed. Please try again."), nil
	}

	if sessionResp.RedirectURL != "" || sessionResp.ButtonConfig != nil {
		// Redirect-based or button-based payment
		returnURL := req.ReturnURL
		if returnURL == "" {
			returnURL = h.requestOrigin
		}
		if !isAllowedReturnURL(returnURL) {
			returnURL = h.requestOrigin
		}

		paymentSession := &gateway.PaymentSession{
			QuoteID:           req.QuoteID,
			AccountID:         accountID,
			CustomerEmail:     h.requestUserEmail,
			SellerID:          q.SellerID,
			PaymentMethod:     req.PaymentMethod,
			DeliveryMethod:    req.DeliveryMethod,
			PickupLocationID:  req.PickupLocationID,
			DeliveryAddressID: req.DeliveryAddressID,
			Amount:            q.GrandTotal,
			Currency:          "USD",
			ProviderSessionID: sessionResp.ProviderSessionID,
			InvoiceRef:        sessionResp.InvoiceRef,
			RedirectURL:       sessionResp.RedirectURL,
			ReturnURL:         returnURL,
		}
		if err := h.gatewayStore.CreateSession(ctx, paymentSession); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to create payment session"), nil
		}

		response := map[string]interface{}{
			"paymentSessionId": paymentSession.ID.Hex(),
		}
		if sessionResp.RedirectURL != "" {
			response["redirectUrl"] = sessionResp.RedirectURL
		}
		if sessionResp.ButtonConfig != nil {
			response["buttonConfig"] = sessionResp.ButtonConfig
		}

		respBody, _ := json.Marshal(response)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusAccepted,
			Headers:    corsHeaders(h.requestOrigin),
			Body:       string(respBody),
		}, nil
	}

	// Direct payment (offline: pickup_&_pay, deliver_pay, purchase_order)
	completion, err := gw.CompleteSession(ctx, sessionResp.ProviderSessionID, sessionResp.InvoiceRef, q.GrandTotal, "USD", credentials, sandbox)
	if err != nil {
		return h.errorResponse(http.StatusPaymentRequired, "Payment processing failed"), nil
	}

	return h.createOrderFromQuote(q, accountID, h.requestUserEmail, req.PaymentMethod, req.DeliveryMethod, completion.TransactionID, req.PickupLocationID, req.DeliveryAddressID)
}

func (h *LambdaHandler) createOrderFromQuote(q *quote.Quote, accountID, customerEmail, paymentMethod, deliveryMethod, transactionID, pickupLocationID, deliveryAddressID string) (events.APIGatewayProxyResponse, error) {
	newOrder := &order.Order{
		ID:                primitive.NewObjectID(),
		QuoteID:           q.ID,
		AccountID:         accountID,
		SellerID:          q.SellerID,
		Items:             q.Items,
		Subtotal:          q.Subtotal,
		ShippingCost:      q.ShippingCost,
		TaxAmount:         q.TaxAmount,
		GrandTotal:        q.GrandTotal,
		PaymentMethod:     paymentMethod,
		DeliveryMethod:    deliveryMethod,
		TransactionID:     transactionID,
		PickupLocationID:  pickupLocationID,
		DeliveryAddressID: deliveryAddressID,
		CustomerEmail:     customerEmail,
	}

	createdOrder, err := h.orderService.CreateOrder(newOrder)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create order"), nil
	}

	_ = h.cartService.ClearCart(accountID, q.SellerID)
	if q.QuoteType == "negotiable" {
		_, err = h.quoteService.UpdateQuoteStatus(q.ID, "ordered")
		if err != nil {
			log.Printf("Failed to update quote status to ordered: %v", err)
		}
	} else {
		_ = h.quoteService.DeleteQuote(q.ID.Hex())
	}

	// Order confirmation email — SYNCHRONOUS so it actually delivers.
	// Lambda freezes its execution environment as soon as the handler returns;
	// fire-and-forget goroutines race the freeze and get cut mid-SMTP-handshake
	// (observed: "WARN: order confirmation email failed: EOF" in CloudWatch).
	// We accept ~300ms added to the checkout response to guarantee delivery.
	// Customer-facing send routes through the company's own SMTP for branding.
	if h.emailSender != nil && customerEmail != "" {
		items := make([]mailer.OrderItemView, 0, len(createdOrder.Items))
		for _, it := range createdOrder.Items {
			items = append(items, mailer.OrderItemView{
				Name:     it.Name,
				Quantity: it.Quantity,
				Price:    it.Price,
			})
		}
		msg := mailer.OrderConfirmationMessage(customerEmail, mailer.OrderConfirmationData{
			OrderID:    createdOrder.ID.Hex(),
			GrandTotal: createdOrder.GrandTotal,
			Items:      items,
		})
		sender, _ := mailer.SenderForCompany(context.Background(), createdOrder.SellerID, h.emailSender)
		if err := sender.Send(context.Background(), msg); err != nil {
			log.Printf("WARN: order confirmation email failed for %s: %v", customerEmail, err)
		}

		// Notify the company owner about the new order — platform sender (BC SES).
		if ownerEmail := mailer.CompanyOwnerEmail(createdOrder.SellerID); ownerEmail != "" {
			ownerMsg := mailer.NewOrderToCompanyMessage(ownerEmail, mailer.NewOrderToCompanyData{
				OrderID:        createdOrder.ID.Hex(),
				CustomerEmail:  customerEmail,
				GrandTotal:     createdOrder.GrandTotal,
				Items:          items,
			})
			if err := h.emailSender.Send(context.Background(), ownerMsg); err != nil {
				log.Printf("WARN: new-order notification to owner %s failed: %v", ownerEmail, err)
			}
		}
	}

	return h.successResponse(createdOrder), nil
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

// handleGetStatementRequest computes a billing statement for a seller and period.
// GET /checkout/orders/statement?sellerId=<id>&from=<RFC3339>&to=<RFC3339>
// Auth: admin can request any sellerId; company can request only their own.
// Pure routing/auth — business logic lives in statement.Compute.
func (h *LambdaHandler) handleGetStatementRequest(request events.APIGatewayProxyRequest, accountID string, role string) (events.APIGatewayProxyResponse, error) {
	sellerID := request.QueryStringParameters["sellerId"]
	if sellerID == "" {
		return h.errorResponse(http.StatusBadRequest, "sellerId required"), nil
	}
	if role != "admin" && !(role == "company" && sellerID == accountID) {
		return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
	}

	fromStr := request.QueryStringParameters["from"]
	toStr := request.QueryStringParameters["to"]
	if fromStr == "" || toStr == "" {
		return h.errorResponse(http.StatusBadRequest, "from and to required (RFC3339)"), nil
	}
	from, err := time.Parse(time.RFC3339, fromStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid from date"), nil
	}
	to, err := time.Parse(time.RFC3339, toStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid to date"), nil
	}
	if !to.After(from) {
		return h.errorResponse(http.StatusBadRequest, "to must be after from"), nil
	}
	if to.Sub(from) > 366*24*time.Hour {
		return h.errorResponse(http.StatusBadRequest, "period exceeds 1 year"), nil
	}

	orders, err := h.orderService.GetSellerOrdersInPeriod(sellerID, from, to)
	if err != nil {
		log.Printf("ERROR: GetSellerOrdersInPeriod: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to fetch orders"), nil
	}

	computed := statement.Compute(sellerID, from, to, orders)
	respBody, _ := json.Marshal(computed)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}, nil
}

// handleSendStatementRequest sends (or dry-run-renders) a billing statement
// email to a company. Admin-only. On a real (non-dryRun) send, the computed
// values are snapshotted to the statements collection so historical
// recomputation can never drift from what the company was actually billed.
//
// POST /checkout/orders/statement/send
// Body: { sellerId, from (RFC3339), to (RFC3339), recipientEmail, companyName,
//         periodLabel, paymentInstructions, dryRun }
func (h *LambdaHandler) handleSendStatementRequest(request events.APIGatewayProxyRequest, accountID string, role string) (events.APIGatewayProxyResponse, error) {
	if role != "admin" {
		return h.errorResponse(http.StatusForbidden, "Forbidden: admin only"), nil
	}

	var req struct {
		SellerID            string `json:"sellerId"`
		From                string `json:"from"`
		To                  string `json:"to"`
		RecipientEmail      string `json:"recipientEmail"`
		CompanyName         string `json:"companyName"`
		PeriodLabel         string `json:"periodLabel"`
		PaymentInstructions string `json:"paymentInstructions"`
		DryRun              bool   `json:"dryRun"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}
	if req.SellerID == "" || req.From == "" || req.To == "" || req.RecipientEmail == "" || req.CompanyName == "" || req.PeriodLabel == "" {
		return h.errorResponse(http.StatusBadRequest, "sellerId, from, to, recipientEmail, companyName, periodLabel are required"), nil
	}
	if _, err := mail.ParseAddress(req.RecipientEmail); err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid recipientEmail"), nil
	}
	if len(req.PaymentInstructions) > 2000 {
		return h.errorResponse(http.StatusBadRequest, "paymentInstructions too long (max 2000 chars)"), nil
	}

	from, err := time.Parse(time.RFC3339, req.From)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid from date"), nil
	}
	to, err := time.Parse(time.RFC3339, req.To)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "invalid to date"), nil
	}
	if !to.After(from) {
		return h.errorResponse(http.StatusBadRequest, "to must be after from"), nil
	}
	if to.Sub(from) > 366*24*time.Hour {
		return h.errorResponse(http.StatusBadRequest, "period exceeds 1 year"), nil
	}

	orders, err := h.orderService.GetSellerOrdersInPeriod(req.SellerID, from, to)
	if err != nil {
		log.Printf("ERROR: GetSellerOrdersInPeriod: %v", err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to fetch orders"), nil
	}

	computed := statement.Compute(req.SellerID, from, to, orders)
	emailData := buildStatementEmailData(computed, req.CompanyName, req.PeriodLabel, req.PaymentInstructions)
	msg := mailer.MonthlyStatementMessage(req.RecipientEmail, emailData)

	if req.DryRun {
		// Return the rendered email body without sending. Admin previews before commit.
		respBody, _ := json.Marshal(map[string]interface{}{
			"dryRun":    true,
			"recipient": req.RecipientEmail,
			"subject":   msg.Subject,
			"htmlBody":  msg.HTMLBody,
			"textBody":  msg.TextBody,
			"statement": computed,
		})
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers:    corsHeaders(h.requestOrigin),
			Body:       string(respBody),
		}, nil
	}

	if h.emailSender == nil {
		return h.errorResponse(http.StatusServiceUnavailable, "Email sender not configured"), nil
	}
	if err := h.emailSender.Send(context.Background(), msg); err != nil {
		log.Printf("ERROR: statement email send failed for seller=%s recipient=%s: %v", req.SellerID, req.RecipientEmail, err)
		return h.errorResponse(http.StatusInternalServerError, "Failed to send email"), nil
	}
	log.Printf("INFO: statement email sent to %s for seller=%s period=%s total=$%.2f", req.RecipientEmail, req.SellerID, req.PeriodLabel, computed.TotalDue)

	// Snapshot the sent statement. The send already succeeded, so DB failure
	// here means the customer got a bill we don't have a record of — log loudly
	// but still return success so admin knows the email went out.
	snapshot := &statement.Statement{
		SellerID:            req.SellerID,
		PeriodStart:         from,
		PeriodEnd:           to,
		PeriodLabel:         req.PeriodLabel,
		OrderCount:          computed.OrderCount,
		TotalGrandTotal:     computed.TotalGrandTotal,
		Tier:                computed.Tier,
		MonthlyFee:          computed.MonthlyFee,
		PerOrderRate:        computed.PerOrderRate,
		PerOrderCap:         computed.PerOrderCap,
		TransactionFees:     computed.TransactionFees,
		TotalDue:            computed.TotalDue,
		RecipientEmail:      req.RecipientEmail,
		CompanyName:         req.CompanyName,
		PaymentInstructions: req.PaymentInstructions,
		SentAt:              time.Now().UTC(),
		SentByAdminID:       accountID,
	}
	saved, saveErr := h.statementService.Save(snapshot)
	if saveErr != nil {
		log.Printf("ERROR: statement snapshot save failed (email already sent) seller=%s: %v", req.SellerID, saveErr)
	}

	respBody, _ := json.Marshal(map[string]interface{}{
		"dryRun":    false,
		"sent":      true,
		"recipient": req.RecipientEmail,
		"statement": computed,
		"snapshot":  saved,
	})
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    corsHeaders(h.requestOrigin),
		Body:       string(respBody),
	}, nil
}

// handleStatementsRequest serves persisted statement history (GET) and admin
// retraction (DELETE for a statement sent in error). All other methods rejected.
//   GET    /checkout/statements?sellerId=<id>   admin or own-seller
//   DELETE /checkout/statements/{id}            admin only
func (h *LambdaHandler) handleStatementsRequest(request events.APIGatewayProxyRequest, accountID string, role string) (events.APIGatewayProxyResponse, error) {
	parts := strings.Split(strings.Trim(request.Path, "/"), "/")
	// parts: ["checkout", "statements"] or ["checkout", "statements", "{id}"]

	if request.HTTPMethod == "GET" && len(parts) == 2 {
		sellerID := request.QueryStringParameters["sellerId"]
		if sellerID == "" {
			return h.errorResponse(http.StatusBadRequest, "sellerId required"), nil
		}
		if role != "admin" && !(role == "company" && sellerID == accountID) {
			return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
		}
		stmts, err := h.statementService.ListBySeller(sellerID, 24)
		if err != nil {
			log.Printf("ERROR: ListBySeller: %v", err)
			return h.errorResponse(http.StatusInternalServerError, "Failed to fetch statements"), nil
		}
		if stmts == nil {
			stmts = []*statement.Statement{}
		}
		respBody, _ := json.Marshal(stmts)
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers:    corsHeaders(h.requestOrigin),
			Body:       string(respBody),
		}, nil
	}

	if request.HTTPMethod == "DELETE" && len(parts) == 3 {
		if role != "admin" {
			return h.errorResponse(http.StatusForbidden, "Forbidden: admin only"), nil
		}
		oid, err := primitive.ObjectIDFromHex(parts[2])
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "invalid statement id"), nil
		}
		ok, err := h.statementService.Delete(oid)
		if err != nil {
			log.Printf("ERROR: statement Delete: %v", err)
			return h.errorResponse(http.StatusInternalServerError, "Failed to delete"), nil
		}
		if !ok {
			return h.errorResponse(http.StatusNotFound, "Statement not found"), nil
		}
		log.Printf("INFO: admin %s retracted statement %s", accountID, parts[2])
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers:    corsHeaders(h.requestOrigin),
			Body:       `{"deleted":true}`,
		}, nil
	}

	return h.errorResponse(http.StatusMethodNotAllowed, "Use GET /checkout/statements or DELETE /checkout/statements/{id}"), nil
}

// buildStatementEmailData adapts the statement.Computed domain object to the
// flat email DTO. Pre-formats the per-order rate string so the email package
// stays decoupled from pricing-tier logic.
func buildStatementEmailData(stmt statement.Computed, companyName, periodLabel, paymentInstructions string) mailer.MonthlyStatementData {
	var rateStr string
	if stmt.PerOrderCap != nil {
		rateStr = fmt.Sprintf("%.2f%%, capped at $%.0f/order", stmt.PerOrderRate*100, *stmt.PerOrderCap)
	} else {
		rateStr = fmt.Sprintf("%.2f%% per order", stmt.PerOrderRate*100)
	}
	return mailer.MonthlyStatementData{
		CompanyName:         companyName,
		PeriodLabel:         periodLabel,
		Tier:                stmt.Tier,
		OrderCount:          stmt.OrderCount,
		TotalGrandTotal:     stmt.TotalGrandTotal,
		MonthlyFee:          stmt.MonthlyFee,
		PerOrderRateStr:     rateStr,
		TransactionFees:     stmt.TransactionFees,
		TotalDue:            stmt.TotalDue,
		PaymentInstructions: paymentInstructions,
	}
}

func (h *LambdaHandler) handleDeleteOrderRequest(orderIDStr string, role string) (events.APIGatewayProxyResponse, error) {
	if role != "admin" {
		return h.errorResponse(http.StatusForbidden, "Forbidden: admin only"), nil
	}
	orderID, err := primitive.ObjectIDFromHex(orderIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid order ID"), nil
	}
	if err := h.orderService.DeleteOrder(orderID); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to delete order"), nil
	}
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusNoContent,
		Headers:    corsHeaders(h.requestOrigin),
	}, nil
}

var validOrderStatuses = map[string]bool{
	"pending": true, "processing": true, "shipped": true,
	"delivered": true, "cancelled": true, "returned": true,
}

var validTrackingCarriers = map[string]bool{
	"ups": true, "fedex": true, "usps": true, "dhl": true, "other": true,
}

func trackingURLFor(carrier, number string) string {
	if number == "" {
		return ""
	}
	switch carrier {
	case "ups":
		return "https://www.ups.com/track?tracknum=" + number
	case "fedex":
		return "https://www.fedex.com/fedextrack/?tracknumbers=" + number
	case "usps":
		return "https://tools.usps.com/go/TrackConfirmAction?tLabels=" + number
	case "dhl":
		return "https://www.dhl.com/en/express/tracking.html?AWB=" + number
	}
	return ""
}

func (h *LambdaHandler) handleUpdateOrderRequest(orderIDStr string, request events.APIGatewayProxyRequest, accountID, role string) (events.APIGatewayProxyResponse, error) {
	if role != "admin" && role != "company" {
		return h.errorResponse(http.StatusForbidden, "Forbidden: admin or company only"), nil
	}
	orderID, err := primitive.ObjectIDFromHex(orderIDStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid order ID"), nil
	}
	var req struct {
		Status          string `json:"status"`
		TrackingNumber  string `json:"trackingNumber"`
		TrackingCarrier string `json:"trackingCarrier"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}
	if req.Status != "" && !validOrderStatuses[req.Status] {
		return h.errorResponse(http.StatusBadRequest, "Invalid status"), nil
	}
	if req.TrackingCarrier != "" && !validTrackingCarriers[req.TrackingCarrier] {
		return h.errorResponse(http.StatusBadRequest, "Invalid carrier"), nil
	}
	existing, err := h.orderService.GetByID(orderID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Order not found"), nil
	}
	if role == "company" && existing.SellerID != accountID {
		return h.errorResponse(http.StatusForbidden, "Forbidden: not your order"), nil
	}

	updated, err := h.orderService.UpdateOrder(orderID, order.OrderUpdate{
		Status:          req.Status,
		TrackingNumber:  req.TrackingNumber,
		TrackingCarrier: req.TrackingCarrier,
		TrackingURL:     trackingURLFor(req.TrackingCarrier, req.TrackingNumber),
	})
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to update order"), nil
	}

	// Notify customer when order first transitions to "shipped" — synchronous so it
	// actually delivers (same Lambda goroutine-vs-freeze concern as confirmation).
	if req.Status == "shipped" && existing.Status != "shipped" && updated.CustomerEmail != "" && h.emailSender != nil {
		msg := mailer.OrderShippedMessage(updated.CustomerEmail, mailer.OrderShippedData{
			OrderID:         updated.ID.Hex(),
			TrackingCarrier: updated.TrackingCarrier,
			TrackingNumber:  updated.TrackingNumber,
			TrackingURL:     updated.TrackingURL,
		})
		sender, _ := mailer.SenderForCompany(context.Background(), updated.SellerID, h.emailSender)
		if err := sender.Send(context.Background(), msg); err != nil {
			log.Printf("WARN: order shipped email failed for %s: %v", updated.CustomerEmail, err)
		}
	}

	return h.successResponse(updated), nil
}

func (h *LambdaHandler) handleCreateQuoteRequest(request events.APIGatewayProxyRequest, accountID string, role string, configurations []CustomerConfiguration) (events.APIGatewayProxyResponse, error) {
	var req struct {
		CartID                string                  `json:"cartId"`
		SellerID              string                  `json:"sellerId"`
		AccountID             string                  `json:"accountId"`
		PaymentMethods        []string                `json:"paymentMethods"`
		DeliveryMethods       []string                `json:"deliveryMethods"`
		ShippingOutOptions    []string                `json:"shippingOutOptions"`
		CompanyLocations      []quote.CompanyLocation `json:"companyLocations"`
		CustomerAddresses     []quote.CustomerAddress `json:"customerAddresses"`
		QuoteType             string                  `json:"quoteType"`
		QuotesAllowed         bool                    `json:"quotesAllowed"`
		CreditLimit           float64                 `json:"creditLimit"`
		MinOrderAmountLimit   float64                 `json:"minOrderAmountLimit"`
		MaxOrderAmountLimit   float64                 `json:"maxOrderAmountLimit"`
		MinOrderQuantityLimit float64                 `json:"minOrderQuantityLimit"`
		MaxOrderQuantityLimit float64                 `json:"maxOrderQuantityLimit"`
		MonthlyOrderLimit     float64                 `json:"monthlyOrderLimit"`
		YearlyOrderLimit      float64                 `json:"yearlyOrderLimit"`
		TaxableGoods          *bool                   `json:"taxableGoods,omitempty"`
		TaxRate               float64                 `json:"taxRate"`
		ShippingRate          float64                 `json:"shippingRate"`
		LeadTime              float64                 `json:"leadTime"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	// Determine the effective AccountID
	effectiveAccountID := accountID
	if (role == "company" || role == "admin") && req.AccountID != "" {
		if role == "company" && req.SellerID != accountID {
			return h.errorResponse(http.StatusForbidden, "Forbidden: Company can only create quotes for its own customers."), nil
		}
		effectiveAccountID = req.AccountID
	}

	// Resolve effective config: start with company defaults, apply customer overrides from JWT
	effectiveQuotesAllowed := req.QuotesAllowed
	effectiveCreditLimit := req.CreditLimit
	effectiveMinOrderAmount := req.MinOrderAmountLimit
	effectiveMaxOrderAmount := req.MaxOrderAmountLimit
	effectiveMinOrderQty := req.MinOrderQuantityLimit
	effectiveMaxOrderQty := req.MaxOrderQuantityLimit
	effectiveMonthlyLimit := req.MonthlyOrderLimit
	effectiveYearlyLimit := req.YearlyOrderLimit
	effectiveTaxable := true // default: charge tax unless explicitly disabled
	if req.TaxableGoods != nil {
		effectiveTaxable = *req.TaxableGoods
	}
	effectiveTaxRate := req.TaxRate       // company default (from JWT), 0 if not set
	effectiveShippingRate := req.ShippingRate // company default, 0 if not set
	effectiveLeadTime := req.LeadTime

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
			if config.CreditLimit != nil {
				effectiveCreditLimit = *config.CreditLimit
			}
			if config.MinOrderAmountLimit != nil {
				effectiveMinOrderAmount = *config.MinOrderAmountLimit
			}
			if config.MaxOrderAmountLimit != nil {
				effectiveMaxOrderAmount = *config.MaxOrderAmountLimit
			}
			if config.MinOrderQuantityLimit != nil {
				effectiveMinOrderQty = *config.MinOrderQuantityLimit
			}
			if config.MaxOrderQuantityLimit != nil {
				effectiveMaxOrderQty = *config.MaxOrderQuantityLimit
			}
			if config.MonthlyOrderLimit != nil {
				effectiveMonthlyLimit = *config.MonthlyOrderLimit
			}
			if config.YearlyOrderLimit != nil {
				effectiveYearlyLimit = *config.YearlyOrderLimit
			}
			if config.TaxableGoods != nil {
				effectiveTaxable = *config.TaxableGoods
			}
			if config.TaxRate != nil {
				effectiveTaxRate = *config.TaxRate
			}
			if config.ShippingRate != nil {
				effectiveShippingRate = *config.ShippingRate
			}
			if config.LeadTime != nil {
				effectiveLeadTime = *config.LeadTime
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

	// Calculate totals — taxRate is a percentage (e.g., 8.25 means 8.25%)
	taxAmount := cart.TotalPrice * (effectiveTaxRate / 100)
	if !effectiveTaxable || effectiveTaxRate <= 0 {
		taxAmount = 0
	}
	shippingCost := effectiveShippingRate
	grandTotal := cart.TotalPrice + shippingCost + taxAmount

	// Calculate total item quantity
	var totalQuantity float64
	for _, item := range cart.Items {
		totalQuantity += float64(item.Quantity)
	}

	// Enforce order amount limits (0 = no limit)
	if effectiveMinOrderAmount > 0 && grandTotal < effectiveMinOrderAmount {
		return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("Order total $%.2f is below the minimum of $%.2f.", grandTotal, effectiveMinOrderAmount)), nil
	}
	if effectiveMaxOrderAmount > 0 && grandTotal > effectiveMaxOrderAmount {
		return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("Order total $%.2f exceeds the maximum of $%.2f.", grandTotal, effectiveMaxOrderAmount)), nil
	}

	// Enforce order quantity limits (0 = no limit)
	if effectiveMinOrderQty > 0 && totalQuantity < effectiveMinOrderQty {
		return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("Order quantity %.0f is below the minimum of %.0f.", totalQuantity, effectiveMinOrderQty)), nil
	}
	if effectiveMaxOrderQty > 0 && totalQuantity > effectiveMaxOrderQty {
		return h.errorResponse(http.StatusBadRequest, fmt.Sprintf("Order quantity %.0f exceeds the maximum of %.0f.", totalQuantity, effectiveMaxOrderQty)), nil
	}

	// Enforce credit limit (0 = no limit)
	if effectiveCreditLimit > 0 {
		unpaidTotal, err := h.orderService.GetUnpaidOrdersTotal(effectiveAccountID, req.SellerID)
		if err != nil {
			log.Printf("Warning: Failed to check credit limit: %v", err)
		} else if unpaidTotal+grandTotal > effectiveCreditLimit {
			return h.errorResponse(http.StatusForbidden, fmt.Sprintf("Credit limit exceeded. Limit: $%.2f, Outstanding: $%.2f, This order: $%.2f.", effectiveCreditLimit, unpaidTotal, grandTotal)), nil
		}
	}

	// Enforce monthly order limit (0 = no limit)
	if effectiveMonthlyLimit > 0 {
		now := time.Now()
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		count, err := h.orderService.CountOrdersSince(effectiveAccountID, req.SellerID, monthStart)
		if err != nil {
			log.Printf("Warning: Failed to check monthly order limit: %v", err)
		} else if float64(count) >= effectiveMonthlyLimit {
			return h.errorResponse(http.StatusForbidden, fmt.Sprintf("Monthly order limit of %.0f reached.", effectiveMonthlyLimit)), nil
		}
	}

	// Enforce yearly order limit (0 = no limit)
	if effectiveYearlyLimit > 0 {
		now := time.Now()
		yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		count, err := h.orderService.CountOrdersSince(effectiveAccountID, req.SellerID, yearStart)
		if err != nil {
			log.Printf("Warning: Failed to check yearly order limit: %v", err)
		} else if float64(count) >= effectiveYearlyLimit {
			return h.errorResponse(http.StatusForbidden, fmt.Sprintf("Yearly order limit of %.0f reached.", effectiveYearlyLimit)), nil
		}
	}

	initialStatus := "draft"
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
		ShippingRate:                effectiveShippingRate,
		TaxAmount:                   taxAmount,
		TaxRate:                     effectiveTaxRate,
		GrandTotal:                  grandTotal,
		AvailablePaymentMethods:     req.PaymentMethods,
		AvailableDeliveryMethods:    req.DeliveryMethods,
		AvailableShippingOutOptions: req.ShippingOutOptions,
		CompanyLocations:            req.CompanyLocations,
		CustomerAddresses:           req.CustomerAddresses,
		QuoteType:                   req.QuoteType,
		Status:                      initialStatus,
		LeadTime:                    effectiveLeadTime,
	}

	createdQuote, err := h.quoteService.CreateQuote(newQuote)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create or update quote"), nil
	}

	// Quote-requested email — synchronous so it actually delivers (same Lambda
	// goroutine-vs-freeze issue as order confirmation). Customer-facing → routes
	// through company's SMTP for branding.
	if h.emailSender != nil && h.requestUserEmail != "" && req.QuoteType == "negotiable" && role == "customer" {
		msg := mailer.QuoteRequestedMessage(h.requestUserEmail, mailer.QuoteRequestedData{QuoteID: createdQuote.ID.Hex()})
		sender, _ := mailer.SenderForCompany(context.Background(), createdQuote.SellerID, h.emailSender)
		if err := sender.Send(context.Background(), msg); err != nil {
			log.Printf("WARN: quote requested email failed for %s: %v", h.requestUserEmail, err)
		}
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
		if req.Entity.Quantity <= 0 {
			return h.errorResponse(http.StatusBadRequest, "Quantity must be greater than 0"), nil
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

		if req.Entity.Quantity <= 0 {
			return h.errorResponse(http.StatusBadRequest, "Quantity must be greater than 0"), nil
		}
		currentCart, err := h.cartService.GetCart(effectiveAccountID, sellerID)
		if err != nil {
			return h.errorResponse(http.StatusNotFound, "Cart not found"), nil
		}

		found := false
		for i, item := range currentCart.Items {
			if item.ID == objID {
				currentCart.Items[i].Quantity = req.Entity.Quantity
				if req.Entity.Price > 0 {
					currentCart.Items[i].Price = req.Entity.Price
				}
				if req.Entity.DiscountedPrice > 0 {
					currentCart.Items[i].DiscountedPrice = req.Entity.DiscountedPrice
				}
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

func (h *LambdaHandler) redirectResponse(redirectURL string) (events.APIGatewayProxyResponse, error) {
	return events.APIGatewayProxyResponse{
		StatusCode: 302,
		Headers: map[string]string{
			"Location": redirectURL,
		},
	}, nil
}

func isAllowedReturnURL(rawURL string) bool {
	if rawURL == "" {
		return false
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	host := parsed.Hostname()
	// Allow businesscart.ai and all subdomains
	if host == "businesscart.ai" || strings.HasSuffix(host, ".businesscart.ai") {
		return true
	}
	// Allow localhost for development
	if host == "localhost" || host == "127.0.0.1" {
		return true
	}
	return false
}

func (h *LambdaHandler) handleAmazonPayInitRequest(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	checkoutSessionID := request.QueryStringParameters["checkoutSessionId"]
	merchantID := request.QueryStringParameters["merchantId"]
	sandbox := request.QueryStringParameters["sandbox"] == "true"
	currency := request.QueryStringParameters["currency"]
	if currency == "" {
		currency = "USD"
	}

	if checkoutSessionID == "" || merchantID == "" {
		return h.errorResponse(http.StatusBadRequest, "Missing required parameters"), nil
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Redirecting to Amazon Pay</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}
.c{text-align:center;padding:2rem}.sp{width:40px;height:40px;border:4px solid #ddd;border-top:4px solid #f90;border-radius:50%%;animation:s 1s linear infinite;margin:0 auto 1rem}
@keyframes s{to{transform:rotate(360deg)}}</style></head>
<body><div class="c"><div class="sp"></div><p>Redirecting to Amazon Pay...</p></div>
<script src="https://static-na.payments-amazon.com/checkout.js"></script>
<script>
amazon.Pay.initCheckout({merchantId:'%s',ledgerCurrency:'%s',sandbox:%t,
checkoutSessionId:'%s',productType:'PayOnly',placement:'Checkout'});
</script></body></html>`, merchantID, currency, sandbox, checkoutSessionID)

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers:    map[string]string{"Content-Type": "text/html; charset=utf-8"},
		Body:       html,
	}, nil
}

func buildRedirectURL(base, status, orderID string) string {
	u, err := url.Parse(base)
	if err != nil {
		return base + "?status=" + status
	}
	q := u.Query()
	q.Set("status", status)
	if orderID != "" {
		q.Set("orderId", orderID)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// --- Gateway Config CRUD (company/admin only) ---

func (h *LambdaHandler) handleGatewayRequest(request events.APIGatewayProxyRequest, accountID, role string) (events.APIGatewayProxyResponse, error) {
	if role != "company" && role != "admin" {
		return h.errorResponse(http.StatusForbidden, "Only company or admin can manage gateways"), nil
	}
	if h.gatewayStore == nil {
		return h.errorResponse(http.StatusServiceUnavailable, "Gateway service not configured"), nil
	}

	parts := strings.Split(request.Path, "/")
	if len(parts) < 4 {
		return h.errorResponse(http.StatusBadRequest, "Seller ID required"), nil
	}
	sellerID := parts[3]

	if role == "company" && sellerID != accountID {
		return h.errorResponse(http.StatusForbidden, "Cannot manage gateways for another company"), nil
	}

	ctx := context.Background()

	switch request.HTTPMethod {
	case "PUT":
		var req struct {
			Gateway            string            `json:"gateway"`
			DisplayName        string            `json:"displayName"`
			Credentials        map[string]string `json:"credentials"`
			SandboxCredentials map[string]string `json:"sandboxCredentials"`
			Sandbox            bool              `json:"sandbox"`
		}
		if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
		}

		if req.Gateway == "" {
			return h.errorResponse(http.StatusBadRequest, "gateway is required"), nil
		}

		// Validate credentials with the gateway implementation
		gw, ok := h.gatewayRegistry.Get(req.Gateway)
		if ok {
			if len(req.Credentials) > 0 {
				if err := gw.ValidateCredentials(req.Credentials); err != nil {
					return h.errorResponse(http.StatusBadRequest, "Invalid production credentials: "+err.Error()), nil
				}
			}
			if len(req.SandboxCredentials) > 0 {
				if err := gw.ValidateCredentials(req.SandboxCredentials); err != nil {
					return h.errorResponse(http.StatusBadRequest, "Invalid sandbox credentials: "+err.Error()), nil
				}
			}
		}

		config := &gateway.GatewayConfig{
			SellerID:           sellerID,
			Gateway:            req.Gateway,
			DisplayName:        req.DisplayName,
			Credentials:        req.Credentials,
			SandboxCredentials: req.SandboxCredentials,
			Sandbox:            req.Sandbox,
		}
		if err := h.gatewayStore.SaveConfig(ctx, config); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to save gateway config"), nil
		}

		return h.successResponse(map[string]string{"message": "Gateway configured successfully"}), nil

	case "GET":
		configs, err := h.gatewayStore.ListConfigs(ctx, sellerID)
		if err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to list gateway configs"), nil
		}
		return h.successResponse(configs), nil

	case "DELETE":
		if len(parts) < 5 {
			return h.errorResponse(http.StatusBadRequest, "Gateway name required in path"), nil
		}
		gatewayName := parts[4]
		if err := h.gatewayStore.DeleteConfig(ctx, sellerID, gatewayName); err != nil {
			return h.errorResponse(http.StatusInternalServerError, "Failed to delete gateway config"), nil
		}
		return h.successResponse(map[string]string{"message": "Gateway removed"}), nil
	}

	return h.errorResponse(http.StatusMethodNotAllowed, "Method not allowed"), nil
}

// --- Payment Return (browser redirect from payment provider, NO JWT) ---

func (h *LambdaHandler) handlePaymentReturnRequest(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if h.gatewayStore == nil {
		return h.errorResponse(http.StatusServiceUnavailable, "Gateway service not configured"), nil
	}

	ctx := context.Background()

	// Amazon Pay button flow uses "psid" (our session ID) + "amazonCheckoutSessionId" (Amazon's ID)
	// Stripe/Authorize.net use "sessionId" (provider's session ID which is also our providerSessionId)
	providerSessionID := request.QueryStringParameters["psid"]
	amazonCheckoutSessionID := request.QueryStringParameters["amazonCheckoutSessionId"]
	if providerSessionID == "" {
		providerSessionID = request.QueryStringParameters["amazonCheckoutSessionId"]
	}
	if providerSessionID == "" {
		providerSessionID = request.QueryStringParameters["sessionId"]
	}
	if providerSessionID == "" {
		return h.errorResponse(http.StatusBadRequest, "Missing payment session ID"), nil
	}

	// Handle user-cancelled payments (e.g., Stripe cancel button)
	if request.QueryStringParameters["cancelled"] == "true" {
		session, err := h.gatewayStore.GetSessionByProviderID(ctx, providerSessionID)
		if err == nil && session.Status == "pending" {
			_ = h.gatewayStore.UpdateSessionStatus(ctx, session.ID, "cancelled")
		}
		cancelURL := ""
		if session != nil && session.ReturnURL != "" {
			cancelURL = session.ReturnURL
		}
		if cancelURL == "" && session != nil && session.RedirectURL != "" {
			cancelURL = session.RedirectURL
		}
		if cancelURL == "" {
			return h.errorResponse(http.StatusBadRequest, "Payment cancelled but no return URL available"), nil
		}
		return h.redirectResponse(buildRedirectURL(cancelURL, "cancelled", ""))
	}

	// First check if session exists and get returnURL for error redirects
	existingSession, err := h.gatewayStore.GetSessionByProviderID(ctx, providerSessionID)
	if err != nil {
		log.Printf("Payment session not found for provider ID %s: %v", providerSessionID, err)
		return h.errorResponse(http.StatusNotFound, "Payment session not found"), nil
	}

	// Already processed — redirect to result (idempotent)
	if existingSession.Status != "pending" {
		return h.redirectResponse(buildRedirectURL(existingSession.ReturnURL, existingSession.Status, ""))
	}

	// Check expiry before processing
	if time.Now().After(existingSession.ExpiresAt) {
		_ = h.gatewayStore.UpdateSessionStatus(ctx, existingSession.ID, "expired")
		return h.redirectResponse(buildRedirectURL(existingSession.ReturnURL, "expired", ""))
	}

	// Atomically claim the session (pending → processing) to prevent duplicate orders
	paymentSession, err := h.gatewayStore.ClaimSession(ctx, providerSessionID)
	if err != nil {
		// Another request already claimed it — redirect as already processed
		return h.redirectResponse(buildRedirectURL(existingSession.ReturnURL, "completed", ""))
	}

	// Get seller's gateway config
	gatewayConfig, err := h.gatewayStore.GetConfig(ctx, paymentSession.SellerID, paymentSession.PaymentMethod)
	if err != nil {
		log.Printf("Gateway config not found for seller %s, method %s: %v", paymentSession.SellerID, paymentSession.PaymentMethod, err)
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "failed", ""))
	}

	gw, ok := h.gatewayRegistry.Get(paymentSession.PaymentMethod)
	if !ok {
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "failed", ""))
	}

	// Select credentials without mutating the original map
	credentials := gatewayConfig.Credentials
	sandbox := gatewayConfig.Sandbox
	if sandbox {
		credentials = gatewayConfig.SandboxCredentials
	}

	// Complete the payment with the provider
	// For Amazon Pay button flow, use Amazon's checkout session ID for the API call
	completeSessionID := providerSessionID
	if amazonCheckoutSessionID != "" {
		completeSessionID = amazonCheckoutSessionID
	}
	completion, err := gw.CompleteSession(ctx, completeSessionID, paymentSession.InvoiceRef, paymentSession.Amount, paymentSession.Currency, credentials, sandbox)
	if err != nil {
		log.Printf("Gateway CompleteSession failed: %v", err)
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "failed", ""))
	}

	if completion.Status != "completed" {
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "failed", ""))
	}

	// Payment successful — create order from quote
	quoteID, err := primitive.ObjectIDFromHex(paymentSession.QuoteID)
	if err != nil {
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "error", ""))
	}

	q, err := h.quoteService.GetQuote(quoteID)
	if err != nil {
		log.Printf("Quote %s not found during payment return: %v", paymentSession.QuoteID, err)
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "error", ""))
	}

	// Verify quote amount matches what was charged (compare as cents to avoid float precision issues)
	if int(math.Round(q.GrandTotal*100)) != int(math.Round(paymentSession.Amount*100)) {
		log.Printf("Amount mismatch: quote=%.2f, charged=%.2f for session %s", q.GrandTotal, paymentSession.Amount, providerSessionID)
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "error", ""))
	}

	resp, _ := h.createOrderFromQuote(q, paymentSession.AccountID, paymentSession.CustomerEmail, paymentSession.PaymentMethod, paymentSession.DeliveryMethod, completion.TransactionID, paymentSession.PickupLocationID, paymentSession.DeliveryAddressID)

	if resp.StatusCode != http.StatusOK {
		log.Printf("Order creation failed after successful payment for session %s: %s", providerSessionID, resp.Body)
		_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "failed")
		return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "error", ""))
	}

	_ = h.gatewayStore.UpdateSessionStatus(ctx, paymentSession.ID, "completed")

	var orderResult map[string]interface{}
	orderID := ""
	if err := json.Unmarshal([]byte(resp.Body), &orderResult); err == nil {
		if id, ok := orderResult["id"].(string); ok {
			orderID = id
		}
	}

	return h.redirectResponse(buildRedirectURL(paymentSession.ReturnURL, "success", orderID))
}

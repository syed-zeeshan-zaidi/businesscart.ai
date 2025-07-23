package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/golang-jwt/jwt/v5"
	"github.com/syed/businesscart/checkout-service/internal/cart"
	"github.com/syed/businesscart/checkout-service/internal/order"
	"github.com/syed/businesscart/checkout-service/internal/quote"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CheckoutRequest represents the request body for a checkout.
type CheckoutRequest struct {
	CompanyId    string          `json:"companyId"`
	PromoCode    string          `json:"promoCode,omitempty"`
	PaymentToken string          `json:"paymentToken"`
	Items        []cart.CartItem `json:"items"`
}

// CartItemRequest represents the request body for adding/updating a cart item.
type CartItemRequest struct {
	Entity cart.CartItem `json:"entity"`
}

// LambdaHandler handles AWS Lambda proxy requests.
type LambdaHandler struct {
	cartService     *cart.Service
	quoteService    *quote.Service
	orderService    *order.Service
	jwtSecret       string
}

// NewLambdaHandler creates a new LambdaHandler.
func NewLambdaHandler(cartService *cart.Service, quoteService *quote.Service, orderService *order.Service, jwtSecret string) *LambdaHandler {
	return &LambdaHandler{
		cartService:     cartService,
		quoteService:    quoteService,
		orderService:    orderService,
		jwtSecret:       jwtSecret,
	}
}

// HandleRequest processes an API Gateway Proxy Request.
func (h *LambdaHandler) HandleRequest(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	// Handle preflight OPTIONS requests
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusOK,
			Headers: map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, Authorization",
			},
		}, nil
	}

	log.Printf("Received event: %+v", request)

	// Validate JWT token
	authHeader, ok := request.Headers["Authorization"]
	if !ok || authHeader == "" {
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
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: User claim missing"), nil
	}

	userId, ok := userClaim["id"].(string)
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: User ID missing"), nil
	}

	role, ok := userClaim["role"].(string)
	if !ok {
		return h.errorResponse(http.StatusUnauthorized, "Unauthorized: Role missing"), nil
	}

	companyId, _ := userClaim["company_id"].(string)

	log.Printf("JWT Claims - UserID: %s, Role: %s, CompanyID: %s", userId, role, companyId)

	// Handle Cart API routes
	if strings.HasPrefix(request.Path, "/cart") {
		return h.handleCartRequest(request, userId)
	} else if strings.HasPrefix(request.Path, "/quotes") {
		return h.handleQuoteRequest(request, userId)
	} else if request.Path == "/orders" && request.HTTPMethod == "POST" {
		return h.handlePlaceOrderRequest(request, userId)
	} else if request.Path == "/orders" && request.HTTPMethod == "GET" {
		return h.handleGetOrdersRequest(request, userId, role, companyId)
	} else if request.Path == "/checkout" && request.HTTPMethod == "POST" {
		// This endpoint is now deprecated in favor of /quotes and /orders
		return h.errorResponse(http.StatusGone, "This endpoint is deprecated. Please use /quotes and /orders."), nil
	}

	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

func (h *LambdaHandler) handleQuoteRequest(request events.APIGatewayProxyRequest, userId string) (events.APIGatewayProxyResponse, error) {
	if request.HTTPMethod == "POST" {
		return h.handleCreateQuoteRequest(request, userId)
	}
	if request.HTTPMethod == "GET" {
		parts := strings.Split(request.Path, "/")
		if len(parts) == 3 {
			quoteId := parts[2]
			return h.handleGetQuoteRequest(request, userId, quoteId)
		}
	}
	return h.errorResponse(http.StatusNotFound, "Route not found"), nil
}

func (h *LambdaHandler) handleGetQuoteRequest(request events.APIGatewayProxyRequest, userId string, quoteIdStr string) (events.APIGatewayProxyResponse, error) {
    quoteID, err := primitive.ObjectIDFromHex(quoteIdStr)
	if err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid quote ID"), nil
	}

	quote, err := h.quoteService.GetQuote(quoteID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Quote not found"), nil
	}

    if quote.UserID != userId {
        return h.errorResponse(http.StatusForbidden, "Forbidden"), nil
    }

    respBody, _ := json.Marshal(quote)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
		Body: string(respBody),
	}, nil
}

func (h *LambdaHandler) handlePlaceOrderRequest(request events.APIGatewayProxyRequest, userId string) (events.APIGatewayProxyResponse, error) {
	var req struct {
		QuoteID      string `json:"quoteId"`
		PaymentToken string `json:"paymentToken"`
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

	// Mock payment processing
	transactionId := "mock-transaction-123"

	newOrder := &order.Order{
		ID:           primitive.NewObjectID(),
		QuoteID:      quote.ID,
		UserID:       userId,
		CompanyID:    quote.CompanyID,
		Items:        quote.Items,
		Subtotal:     quote.Subtotal,
		ShippingCost: quote.ShippingCost,
		TaxAmount:    quote.TaxAmount,
		GrandTotal:   quote.GrandTotal,
	}
	newOrder.Payment.TransactionID = transactionId

	createdOrder, err := h.orderService.CreateOrder(newOrder)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create order"), nil
	}

	// Clean up cart and quote
	_ = h.cartService.ClearCart(userId, quote.CompanyID)
	_ = h.quoteService.DeleteQuote(req.QuoteID)

	respBody, _ := json.Marshal(createdOrder)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
		Body: string(respBody),
	}, nil
}

func (h *LambdaHandler) handleGetOrdersRequest(request events.APIGatewayProxyRequest, userId string, role string, companyId string) (events.APIGatewayProxyResponse, error) {
	orders, err := h.orderService.GetOrders(userId, role, companyId)
	if err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to get orders"), nil
	}

	respBody, _ := json.Marshal(orders)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
		Body: string(respBody),
	}, nil
}

func (h *LambdaHandler) handleCreateQuoteRequest(request events.APIGatewayProxyRequest, userId string) (events.APIGatewayProxyResponse, error) {
	var req struct {
		CartID    string `json:"cartId"`
		CompanyID string `json:"companyId"`
	}
	if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
		return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
	}

	cart, err := h.cartService.GetCart(userId, req.CompanyID)
	if err != nil {
		return h.errorResponse(http.StatusNotFound, "Cart not found"), nil
	}

	if len(cart.Items) == 0 {
		return h.errorResponse(http.StatusBadRequest, "Cart is empty"), nil
	}

	// Simple tax and shipping calculation (placeholders)
	taxAmount := cart.TotalPrice * 0.0825 // 8.25% tax
	shippingCost := 10.00                  // Flat rate shipping

	newQuote := &quote.Quote{
		CartID:       cart.ID,
		UserID:       userId,
		CompanyID:    req.CompanyID,
		Items:        cart.Items,
		Subtotal:     cart.TotalPrice,
		ShippingCost: shippingCost,
		TaxAmount:    taxAmount,
		GrandTotal:   cart.TotalPrice + shippingCost + taxAmount,
	}

	if err := h.quoteService.CreateQuote(newQuote); err != nil {
		return h.errorResponse(http.StatusInternalServerError, "Failed to create quote"), nil
	}

	respBody, _ := json.Marshal(newQuote)
	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
		Body: string(respBody),
	}, nil
}

func (h *LambdaHandler) handleCartRequest(request events.APIGatewayProxyRequest, userId string) (events.APIGatewayProxyResponse, error) {
	headers := map[string]string{
		"Content-Type":                 "application/json",
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	}
	switch request.HTTPMethod {
	case "POST": // Add item to cart
		var req CartItemRequest
		if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
		}
		currentCart, err := h.cartService.GetCart(userId, req.Entity.CompanyID)
		if err != nil && err.Error() != "cart not found" {
			return h.errorResponse(http.StatusInternalServerError, "Failed to get cart"), nil
		}
		if currentCart == nil {
			currentCart = &cart.Cart{
				UserID:    userId,
				CompanyID: req.Entity.CompanyID,
				Items:     []cart.CartItem{},
			}
		}

		found := false
		for i, item := range currentCart.Items {
			if item.ProductID == req.Entity.ProductID && item.CompanyID == req.Entity.CompanyID {
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
		companyId := request.QueryStringParameters["companyId"]
		if companyId == "" {
			return h.errorResponse(http.StatusBadRequest, "Company ID is required"), nil
		}
		fetchedCart, err := h.cartService.GetCart(userId, companyId)
		if err != nil {
			if err.Error() == "cart not found" {
				// Return an empty cart if not found, as per previous cart-service behavior
				emptyCart := cart.Cart{UserID: userId, CompanyID: companyId, Items: []cart.CartItem{}, TotalPrice: 0}
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
		companyId := request.QueryStringParameters["companyId"]
		if itemId == "" || companyId == "" {
			return h.errorResponse(http.StatusBadRequest, "Item ID and Company ID are required"), nil
		}
		var req CartItemRequest
		if err := json.Unmarshal([]byte(request.Body), &req); err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid request body"), nil
		}

		objID, err := primitive.ObjectIDFromHex(itemId)
		if err != nil {
			return h.errorResponse(http.StatusBadRequest, "Invalid item ID format"), nil
		}

		currentCart, err := h.cartService.GetCart(userId, companyId)
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
		}, nil

	case "DELETE": // Remove item or clear cart
		itemId, hasItemId := request.PathParameters["itemId"]

		if hasItemId && itemId != "" { // Remove specific item
			companyId := request.QueryStringParameters["companyId"]
			if companyId == "" {
				return h.errorResponse(http.StatusBadRequest, "Company ID is required"), nil
			}

			objID, err := primitive.ObjectIDFromHex(itemId)
			if err != nil {
				return h.errorResponse(http.StatusBadRequest, "Invalid item ID format"), nil
			}

			currentCart, err := h.cartService.GetCart(userId, companyId)
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
			}, nil

		} else if request.Path == "/cart" { // Clear entire cart
			companyId := request.QueryStringParameters["companyId"]
			if companyId == "" {
				return h.errorResponse(http.StatusBadRequest, "Company ID is required"), nil
			}
			if err := h.cartService.ClearCart(userId, companyId); err != nil {
				return h.errorResponse(http.StatusInternalServerError, "Failed to clear cart"), nil
			}
			emptyCart := cart.Cart{UserID: userId, CompanyID: companyId, Items: []cart.CartItem{}, TotalPrice: 0}
			respBody, _ := json.Marshal(emptyCart)
			return events.APIGatewayProxyResponse{
				StatusCode: http.StatusOK,
				Headers:    headers,
				Body:       string(respBody),
			}, nil
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
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
		Body: string(respBody),
	}
}
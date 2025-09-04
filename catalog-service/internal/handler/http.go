package handler

import (
	"encoding/json"
	"net/http"

	"business-cart/catalog-service/internal/middleware"
	"business-cart/catalog-service/internal/storage"

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handler struct {
	db        *storage.DB
	jwtSecret string
}

func NewHandler(db *storage.DB, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

func (h *Handler) RegisterRoutes(router *chi.Mux) {
	router.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(h.jwtSecret))
		r.Post("/products", h.CreateProduct)
		r.Get("/products", h.GetProducts)
		r.Get("/products/{id}", h.GetProductByID)
		r.Put("/products/{id}", h.UpdateProduct)
		r.Delete("/products/{id}", h.DeleteProduct)
	})
}

func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	userClaims := r.Context().Value("user").(map[string]interface{})
	if userClaims["role"] != "company" && userClaims["role"] != "admin" {
		http.Error(w, "Unauthorized: Company role required", http.StatusForbidden)
		return
	}

	var product storage.Product
	if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	product.SellerID = userClaims["id"].(string)

	if err := h.db.CreateProduct(&product); err != nil {
		http.Error(w, "Failed to create product", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(product)
}

func (h *Handler) GetProducts(w http.ResponseWriter, r *http.Request) {
	userClaims := r.Context().Value("user").(map[string]interface{})
	role := userClaims["role"].(string)
	accountID := userClaims["id"].(string)

	var filter bson.M
	switch role {
	case "admin":
		filter = bson.M{}
	case "company":
		filter = bson.M{"sellerID": accountID}
	case "customer":
		associateCompanyIDs, ok := userClaims["associate_company_ids"].([]interface{})
		if !ok {
			http.Error(w, "Invalid associate company IDs", http.StatusBadRequest)
			return
		}
		var companyIDs []string
		for _, id := range associateCompanyIDs {
			companyIDs = append(companyIDs, id.(string))
		}
		filter = bson.M{"sellerID": bson.M{"$in": companyIDs}}
	default:
		http.Error(w, "Unauthorized: Invalid role", http.StatusForbidden)
		return
	}

	products, err := h.db.GetProducts(filter)
	if err != nil {
		http.Error(w, "Failed to retrieve products", http.StatusInternalServerError)
		return
	}

	if len(products) == 0 {
		json.NewEncoder(w).Encode([]*storage.Product{})
		return
	}

	json.NewEncoder(w).Encode(products)
}

func (h *Handler) GetProductByID(w http.ResponseWriter, r *http.Request) {
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		http.Error(w, "Product not found", http.StatusNotFound)
		return
	}

	userClaims := r.Context().Value("user").(map[string]interface{})
	if userClaims["role"] != "admin" && product.SellerID != userClaims["id"].(string) {
		http.Error(w, "Unauthorized access to product", http.StatusForbidden)
		return
	}

	json.NewEncoder(w).Encode(product)
}

func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		http.Error(w, "Product not found", http.StatusNotFound)
		return
	}

	userClaims := r.Context().Value("user").(map[string]interface{})
	if product.SellerID != userClaims["id"].(string) {
		http.Error(w, "Unauthorized access to product", http.StatusForbidden)
		return
	}

	var updates bson.M
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.db.UpdateProduct(id, updates); err != nil {
		http.Error(w, "Failed to update product", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}

	product, err := h.db.GetProductByID(id)
	if err != nil {
		http.Error(w, "Product not found", http.StatusNotFound)
		return
	}

	userClaims := r.Context().Value("user").(map[string]interface{})
	if product.SellerID != userClaims["id"].(string) {
		http.Error(w, "Unauthorized access to product", http.StatusForbidden)
		return
	}

	if err := h.db.DeleteProduct(id); err != nil {
		http.Error(w, "Failed to delete product", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

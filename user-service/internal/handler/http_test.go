
package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"business-cart/user-service/internal/storage"

	"github.com/go-chi/chi/v5"
)

func TestRegisterUser(t *testing.T) {
	// Create a new handler with a mock DB
	db := &storage.DB{}
	h := NewHandler(db)

	// Create a new router
	router := chi.NewRouter()
	h.RegisterRoutes(router)

	// Create a new user
	user := storage.User{
		Name:     "Test User",
		Email:    "test@example.com",
		Password: "password",
		Role:     "customer",
	}

	// Marshal the user to JSON
	body, _ := json.Marshal(user)

	// Create a new request
	req, _ := http.NewRequest("POST", "/users/register", bytes.NewReader(body))

	// Create a new response recorder
	rr := httptest.NewRecorder()

	// Serve the request
	router.ServeHTTP(rr, req)

	// Check the status code
	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("handler returned wrong status code: got %v want %v",
			status, http.StatusCreated)
	}
}

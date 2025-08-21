package main

import (
	"context"
	"log"
	"net/http"
	"strings"

	"business-cart/account-service/internal/config"
	"business-cart/account-service/internal/handler"
	"business-cart/account-service/internal/storage"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

var chiRouter *chi.Mux

func init() {
	// Reading config from environment variables
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Setup database
	db, err := storage.NewDB(cfg.MongoURI)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Setup handler
	h := handler.NewHandler(db, cfg.JWTSecret, cfg.JWTRefreshSecret)

	// Setup router
	chiRouter = chi.NewRouter()
	chiRouter.Use(middleware.Logger)
	h.RegisterRoutes(chiRouter)
}

// Adapter to convert API Gateway request to http.Request
func adapter(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	log.Printf("Received headers: %+v", req.Headers)
	// Create a new http.Request
	httpRequest, err := http.NewRequest(req.HTTPMethod, req.Path, strings.NewReader(req.Body))
	if err != nil {
		return events.APIGatewayProxyResponse{StatusCode: 500}, err
	}
	// Copy headers from the API Gateway request to the http.Request
	for key, value := range req.Headers {
		httpRequest.Header.Set(key, value)
	}

	// Use a response writer to capture the response
	w := &responseRecorder{}

	// Serve the request
	chiRouter.ServeHTTP(w, httpRequest)

	// Return the response
	return events.APIGatewayProxyResponse{
		StatusCode:        w.code,
		Body:              w.body.String(),
		MultiValueHeaders: w.Header(),
	}, nil
}

func main() {
	lambda.Start(adapter)
}

// responseRecorder is a custom http.ResponseWriter to capture the response
type responseRecorder struct {
	code   int
	body   strings.Builder
	header http.Header
}

func (r *responseRecorder) Header() http.Header {
	if r.header == nil {
		r.header = make(http.Header)
	}
	return r.header
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	return r.body.Write(b)
}

func (r *responseRecorder) WriteHeader(statusCode int) {
	r.code = statusCode
}

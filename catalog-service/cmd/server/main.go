package main

import (
	"context"
	"log"
	"net/http"
	"strings"

	"business-cart/catalog-service/internal/config"
	"business-cart/catalog-service/internal/handler"
	"business-cart/catalog-service/internal/storage"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

var chiRouter *chi.Mux

func init() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := storage.NewDB(cfg.MongoURI)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	h := handler.NewHandler(db, cfg.JWTSecret)

	chiRouter = chi.NewRouter()
	chiRouter.Use(middleware.Logger)
	h.RegisterRoutes(chiRouter)
}

func adapter(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	httpRequest, err := http.NewRequest(req.HTTPMethod, req.Path, strings.NewReader(req.Body))
	if err != nil {
		return events.APIGatewayProxyResponse{StatusCode: 500}, err
	}
	for key, value := range req.Headers {
		httpRequest.Header.Set(key, value)
	}

	w := &responseRecorder{}
	chiRouter.ServeHTTP(w, httpRequest)

	return events.APIGatewayProxyResponse{
		StatusCode:        w.code,
		Body:              w.body.String(),
		MultiValueHeaders: w.Header(),
	}, nil
}

func main() {
	lambda.Start(adapter)
}

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

package main

import (
	"bytes"
	"context"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"

	"business-cart/user-service/internal/config"
	"business-cart/user-service/internal/handler"
	"business-cart/user-service/internal/storage"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/go-chi/chi/v5"
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

	h := handler.NewHandler(db, cfg.JWTSecret, cfg.JWTRefreshSecret)

	chiRouter = chi.NewRouter()
	h.RegisterRoutes(chiRouter)
}

func Router(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	httpReq, err := newHTTPRequest(req)
	if err != nil {
		return events.APIGatewayProxyResponse{StatusCode: 500}, err
	}

	// Create a response recorder to capture the response
	w := &responseRecorder{}

	// Serve the request
	chiRouter.ServeHTTP(w, httpReq)

	// Construct the API Gateway response
	proxyHeaders := make(map[string]string)
	if w.header != nil {
		for k, v := range w.header {
			proxyHeaders[k] = v[0]
		}
	}

	return events.APIGatewayProxyResponse{
		StatusCode: w.code,
		Body:       w.body.String(),
		Headers:    proxyHeaders,
	}, nil
}

// newHTTPRequest creates a new http.Request from an events.APIGatewayProxyRequest
func newHTTPRequest(req events.APIGatewayProxyRequest) (*http.Request, error) {
	u, err := url.Parse(req.Path)
	if err != nil {
		return nil, err
	}

	body := bytes.NewReader([]byte(req.Body))

	httpReq, err := http.NewRequest(req.HTTPMethod, u.String(), ioutil.NopCloser(body))
	if err != nil {
		return nil, err
	}

	// Set headers
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	return httpReq, nil
}

// responseRecorder is a custom http.ResponseWriter to capture the response
type responseRecorder struct {
	code   int
	body   bytes.Buffer
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

func main() {
	lambda.Start(Router)
}
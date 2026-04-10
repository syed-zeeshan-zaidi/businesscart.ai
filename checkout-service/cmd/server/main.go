package main

import (
	"context"
	"log"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/syed/businesscart/checkout-service/internal/cart"
	"github.com/syed/businesscart/checkout-service/internal/config"
	mailer "github.com/syed/businesscart/checkout-service/internal/email"
	"github.com/syed/businesscart/checkout-service/internal/gateway"
	"github.com/syed/businesscart/checkout-service/internal/handler"
	"github.com/syed/businesscart/checkout-service/internal/order"
	"github.com/syed/businesscart/checkout-service/internal/quote"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	cfg := config.NewConfig()

	log.Printf("Connecting to MongoDB with URI: %s", cfg.MongoURI)
	client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	log.Println("Successfully connected to MongoDB.")

	db := client.Database("CheckoutService")
	cartService := cart.NewService(db)
	quoteService := quote.NewService(db)
	orderService := order.NewService(db)

	// Initialize gateway system
	var gatewayStore *gateway.Store
	gatewayRegistry := gateway.NewRegistry()
	gatewayRegistry.Register("amazon_pay", gateway.NewAmazonPayGateway())
	gatewayRegistry.Register("stripe_pay", gateway.NewStripeGateway())
	gatewayRegistry.Register("credit_card", gateway.NewAuthorizeNetGateway())
	gatewayRegistry.Register("pickup_&_pay", gateway.NewOfflineGateway())
	gatewayRegistry.Register("deliver_pay", gateway.NewOfflineGateway())
	gatewayRegistry.Register("purchase_order", gateway.NewOfflineGateway())

	if cfg.GatewayEncryptionKey != "" {
		var err error
		gatewayStore, err = gateway.NewStore(db, cfg.GatewayEncryptionKey)
		if err != nil {
			log.Fatalf("Gateway store init failed: %v", err)
		}
		log.Println("Gateway store initialized successfully.")
	} else {
		log.Println("WARNING: GATEWAY_ENCRYPTION_KEY not set. Payment gateway features will be unavailable.")
	}

	// Email sender — uses SMTP (stdlib net/smtp). Falls back to no-op if any env var missing.
	emailSender := mailer.NewSender(context.Background(), mailer.Config{
		From:     os.Getenv("EMAIL_FROM_ADDRESS"),
		Host:     os.Getenv("EMAIL_SMTP_HOST"),
		Port:     os.Getenv("EMAIL_SMTP_PORT"),
		Username: os.Getenv("EMAIL_SMTP_USERNAME"),
		Password: os.Getenv("EMAIL_SMTP_PASSWORD"),
	})

	lambdaHandler := handler.NewLambdaHandler(cartService, quoteService, orderService, gatewayStore, gatewayRegistry, cfg.JWTSecret, cfg.APIBaseURL, emailSender)

	log.Println("Starting Lambda handler...")
	lambda.Start(func(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
		return lambdaHandler.HandleRequest(request)
	})
}

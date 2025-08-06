package main

import (
	"context"
	"log"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/syed/businesscart/checkout-service/internal/cart"
	"github.com/syed/businesscart/checkout-service/internal/config"
	"github.com/syed/businesscart/checkout-service/internal/handler"
	"github.com/syed/businesscart/checkout-service/internal/order"
	"github.com/syed/businesscart/checkout-service/internal/payment"
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

	db := client.Database(cfg.MongoDatabase)
	cartService := cart.NewService(db)
	quoteService := quote.NewService(db)
	orderService := order.NewService(db)
	paymentService := payment.NewPaymentService()

	lambdaHandler := handler.NewLambdaHandler(cartService, quoteService, orderService, paymentService, cfg.JWTSecret)

	log.Println("Starting Lambda handler...")
	lambda.Start(func(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
		return lambdaHandler.HandleRequest(request)
	})
}
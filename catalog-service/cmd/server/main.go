package main

import (
	"log"
	"os"

	"business-cart/catalog-service/internal/handler"
	"business-cart/catalog-service/internal/storage"
	"github.com/aws/aws-lambda-go/lambda"
)

func main() {
	db, err := storage.NewDB(os.Getenv("MONGO_URI"))
	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET must be set")
	}

	h := handler.NewLambdaHandler(db, jwtSecret)
	lambda.Start(h.HandleRequest)
}
package main

import (
	"log"
	"os"

	"business-cart/account-service/internal/handler"
	"business-cart/account-service/internal/storage"

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

	jwtRefreshSecret := os.Getenv("JWT_REFRESH_SECRET")
	if jwtRefreshSecret == "" {
		log.Fatal("JWT_REFRESH_SECRET must be set")
	}

	d2cBucketName := os.Getenv("D2C_BUCKET_NAME")
	d2cDistributionId := os.Getenv("D2C_DISTRIBUTION_ID")
	h := handler.NewLambdaHandler(db, jwtSecret, jwtRefreshSecret, d2cBucketName, d2cDistributionId)
	lambda.Start(h.HandleRequest)
}

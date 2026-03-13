package main

import (
	"context"
	"log"
	"os"

	"business-cart/catalog-service/internal/handler"
	"business-cart/catalog-service/internal/storage"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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

	var s3Client *s3.Client
	bucket := os.Getenv("PRODUCT_IMAGES_BUCKET")
	cdnDomain := os.Getenv("PRODUCT_IMAGES_CDN")

	if bucket != "" {
		cfg, err := config.LoadDefaultConfig(context.TODO())
		if err != nil {
			log.Printf("WARNING: Failed to load AWS config for S3: %v", err)
		} else {
			s3Client = s3.NewFromConfig(cfg)
		}
	}

	h := handler.NewLambdaHandler(db, jwtSecret, s3Client, bucket, cdnDomain)
	lambda.Start(h.HandleRequest)
}

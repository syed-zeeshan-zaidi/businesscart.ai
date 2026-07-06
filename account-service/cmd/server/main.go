package main

import (
	"context"
	"log"
	"os"

	mailer "business-cart/account-service/internal/email"
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
	conversionEncryptionKey := os.Getenv("CONVERSION_ENCRYPTION_KEY")

	// Email sender — uses SMTP (stdlib net/smtp). Falls back to no-op if any config missing.
	emailSender := mailer.NewSender(context.Background(), mailer.Config{
		From:     os.Getenv("EMAIL_FROM_ADDRESS"),
		Host:     os.Getenv("EMAIL_SMTP_HOST"),
		Port:     os.Getenv("EMAIL_SMTP_PORT"),
		Username: os.Getenv("EMAIL_SMTP_USERNAME"),
		Password: os.Getenv("EMAIL_SMTP_PASSWORD"),
	})

	h := handler.NewLambdaHandler(db, jwtSecret, jwtRefreshSecret, d2cBucketName, d2cDistributionId, conversionEncryptionKey, emailSender)
	lambda.Start(h.HandleRequest)
}

package main

import (
	"log"
	"os"

	"business-cart/account-service/internal/handler"
	"business-cart/account-service/internal/storage"
<<<<<<< HEAD

	jwtRefreshSecret := os.Getenv("JWT_REFRESH_SECRET")
	if jwtRefreshSecret == "" {
		log.Fatal("JWT_REFRESH_SECRET must be set")
	}

	d2cBucketName := os.Getenv("D2C_BUCKET_NAME")
	h := handler.NewLambdaHandler(db, jwtSecret, jwtRefreshSecret, d2cBucketName)
	lambda.Start(h.HandleRequest)
}

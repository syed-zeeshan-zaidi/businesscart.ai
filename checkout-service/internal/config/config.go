
package config

import "os"

// Config holds the configuration for the application.
type Config struct {
	PaymentServiceUrl string
	OrderServiceUrl   string
	JWTSecret         string
	MongoURI          string
	MongoDatabase     string
}

// NewConfig creates a new Config struct and populates it with values from environment variables.
func NewConfig() *Config {
	return &Config{
		PaymentServiceUrl: getEnv("PAYMENT_SERVICE_URL", "http://localhost:3005"),
		OrderServiceUrl:   getEnv("ORDER_SERVICE_URL", "http://order-service:3003"),
		JWTSecret:         getEnv("JWT_SECRET", "your-secret-key"),
		MongoURI:          getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDatabase:     getEnv("MONGO_DB_NAME", "checkout-service"),
	}
}

// getEnv retrieves an environment variable or returns a fallback value.
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

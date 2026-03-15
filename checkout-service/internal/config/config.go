package config

import "os"

// Config holds the configuration for the application.
type Config struct {
	JWTSecret            string
	MongoURI             string
	GatewayEncryptionKey string
	APIBaseURL           string
}

// NewConfig creates a new Config struct and populates it with values from environment variables.
func NewConfig() *Config {
	return &Config{
		JWTSecret:            os.Getenv("JWT_SECRET"),
		MongoURI:             os.Getenv("MONGO_URI"),
		GatewayEncryptionKey: os.Getenv("GATEWAY_ENCRYPTION_KEY"),
		APIBaseURL:           os.Getenv("API_BASE_URL"),
	}
}

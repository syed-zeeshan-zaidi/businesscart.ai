package config

import "os"

// Config holds the configuration for the application.
type Config struct {
	JWTSecret string
	MongoURI  string
}

// NewConfig creates a new Config struct and populates it with values from environment variables.
func NewConfig() *Config {
	return &Config{
		JWTSecret: os.Getenv("JWT_SECRET"),
		MongoURI:  os.Getenv("MONGO_URI"),
	}
}

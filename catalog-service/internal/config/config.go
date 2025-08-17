package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	MongoURI         string
	JWTSecret        string
	JWTRefreshSecret string
}

func LoadConfig() (*Config, error) {
	// In a Lambda environment, .env file might not be present.
	// We can ignore the error if it's a "not found" error.
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return &Config{
		MongoURI:         os.Getenv("MONGO_URI"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		JWTRefreshSecret: os.Getenv("JWT_REFRESH_SECRET"),
	}, nil
}

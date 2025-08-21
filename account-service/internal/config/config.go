package config

import (
	"os"
)

type Config struct {
	MongoURI         string
	JWTSecret        string
	JWTRefreshSecret string
}

func LoadConfig() (Config, error) {
	config := Config{
		MongoURI:         os.Getenv("MONGO_URI"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		JWTRefreshSecret: os.Getenv("JWT_REFRESH_SECRET"),
	}
	return config, nil
}

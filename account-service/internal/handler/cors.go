package handler

import (
	"os"
	"strings"
)

var allowedOrigins []string

func init() {
	raw := os.Getenv("CORS_ALLOWED_ORIGINS")
	if raw == "" || raw == "*" {
		allowedOrigins = []string{"*"}
	} else {
		for _, o := range strings.Split(raw, ",") {
			allowedOrigins = append(allowedOrigins, strings.TrimSpace(o))
		}
	}
}

// matchCORSOrigin checks the request Origin against the configured allowed
// origins and returns the single value to put in Access-Control-Allow-Origin.
// Supports exact matches and wildcard-subdomain patterns like https://*.example.com.
func matchCORSOrigin(requestOrigin string) string {
	if len(allowedOrigins) == 1 && allowedOrigins[0] == "*" {
		return "*"
	}
	for _, pattern := range allowedOrigins {
		if pattern == requestOrigin {
			return requestOrigin
		}
		// Wildcard subdomain: https://*.businesscart.ai
		if strings.HasPrefix(pattern, "https://*.") {
			suffix := pattern[len("https://*"):]
			if strings.HasPrefix(requestOrigin, "https://") {
				host := requestOrigin[len("https://"):]
				if strings.HasSuffix(host, suffix) && len(host) > len(suffix) {
					return requestOrigin
				}
			}
		}
	}
	return ""
}

func corsHeaders(requestOrigin string) map[string]string {
	origin := matchCORSOrigin(requestOrigin)
	if origin == "" {
		origin = allowedOrigins[0]
	}
	return map[string]string{
		"Content-Type":                     "application/json",
		"Access-Control-Allow-Origin":      origin,
		"Access-Control-Allow-Methods":     "GET, POST, PUT, DELETE, PATCH, OPTIONS",
		"Access-Control-Allow-Headers":     "Content-Type, Authorization, Cookie",
		"Access-Control-Allow-Credentials": "true",
		"Vary":                             "Origin",
	}
}

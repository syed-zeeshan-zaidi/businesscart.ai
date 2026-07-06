package conversion

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
)

// ParseKey decodes the base64-encoded 32-byte AES key from the
// CONVERSION_ENCRYPTION_KEY env var. Mirrors the gateway key format
// (GATEWAY_ENCRYPTION_KEY) so conversion credentials use a dedicated,
// independently-rotatable key rather than one derived from JWT_SECRET.
func ParseKey(b64 string) ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, fmt.Errorf("invalid conversion key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("conversion key must be 32 bytes, got %d", len(key))
	}
	return key, nil
}

// DeriveKey turns any secret into a 32-byte AES key via SHA-256. Retained only
// as a test helper for building a valid key from a string; production uses
// ParseKey with the dedicated CONVERSION_ENCRYPTION_KEY.
func DeriveKey(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// Encrypt AES-256-GCM encrypts plaintext and base64-encodes it. Used when
// seeding a seller's credentials.
func Encrypt(key []byte, plaintext string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ct), nil
}

// Decrypt reverses Encrypt.
func Decrypt(key []byte, encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ns := gcm.NonceSize()
	if len(data) < ns {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ct := data[:ns], data[ns:]
	pt, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", err
	}
	return string(pt), nil
}

package gateway

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Store struct {
	configs  *mongo.Collection
	sessions *mongo.Collection
	aesKey   []byte
}

func NewStore(db *mongo.Database, encryptionKey string) (*Store, error) {
	key, err := base64.StdEncoding.DecodeString(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("invalid encryption key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("encryption key must be 32 bytes, got %d", len(key))
	}

	store := &Store{
		configs:  db.Collection("gateway_configs"),
		sessions: db.Collection("payment_sessions"),
		aesKey:   key,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := store.configs.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "sellerId", Value: 1}, {Key: "gateway", Value: 1}},
		Options: options.Index().SetUnique(true),
	}); err != nil {
		log.Printf("WARNING: Failed to create gateway_configs index: %v", err)
	}
	if _, err := store.sessions.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "providerSessionId", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "expiresAt", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(0),
		},
	}); err != nil {
		log.Printf("WARNING: Failed to create payment_sessions indexes: %v", err)
	}

	return store, nil
}

func (s *Store) encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(s.aesKey)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (s *Store) decrypt(encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(s.aesKey)
	if err != nil {
		return "", err
	}
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonceSize := aesGCM.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func (s *Store) encryptCredentials(creds map[string]string) (map[string]string, error) {
	encrypted := make(map[string]string, len(creds))
	for k, v := range creds {
		enc, err := s.encrypt(v)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt %s: %w", k, err)
		}
		encrypted[k] = enc
	}
	return encrypted, nil
}

func (s *Store) decryptCredentials(creds map[string]string) (map[string]string, error) {
	decrypted := make(map[string]string, len(creds))
	for k, v := range creds {
		dec, err := s.decrypt(v)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt %s: %w", k, err)
		}
		decrypted[k] = dec
	}
	return decrypted, nil
}

// SaveConfig upserts a gateway config for a seller.
func (s *Store) SaveConfig(ctx context.Context, config *GatewayConfig) error {
	now := time.Now()
	setFields := bson.M{
		"displayName": config.DisplayName,
		"sandbox":     config.Sandbox,
		"updatedAt":   now,
	}

	// Encrypt and store production credentials if provided
	if len(config.Credentials) > 0 {
		encrypted, err := s.encryptCredentials(config.Credentials)
		if err != nil {
			return fmt.Errorf("failed to encrypt credentials: %w", err)
		}
		setFields["credentials"] = encrypted
	}

	// Encrypt and store sandbox credentials if provided
	if len(config.SandboxCredentials) > 0 {
		encrypted, err := s.encryptCredentials(config.SandboxCredentials)
		if err != nil {
			return fmt.Errorf("failed to encrypt sandbox credentials: %w", err)
		}
		setFields["sandboxCredentials"] = encrypted
	}

	filter := bson.M{"sellerId": config.SellerID, "gateway": config.Gateway}
	update := bson.M{
		"$set": setFields,
		"$setOnInsert": bson.M{
			"sellerId":  config.SellerID,
			"gateway":   config.Gateway,
			"createdAt": now,
		},
	}
	opts := options.Update().SetUpsert(true)
	_, err := s.configs.UpdateOne(ctx, filter, update, opts)
	return err
}

// GetConfig retrieves a specific gateway config with decrypted credentials.
func (s *Store) GetConfig(ctx context.Context, sellerID, gatewayName string) (*GatewayConfig, error) {
	var config GatewayConfig
	err := s.configs.FindOne(ctx, bson.M{"sellerId": sellerID, "gateway": gatewayName}).Decode(&config)
	if err != nil {
		return nil, err
	}
	if len(config.Credentials) > 0 {
		decrypted, err := s.decryptCredentials(config.Credentials)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt credentials: %w", err)
		}
		config.Credentials = decrypted
	}
	if len(config.SandboxCredentials) > 0 {
		decrypted, err := s.decryptCredentials(config.SandboxCredentials)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt sandbox credentials: %w", err)
		}
		config.SandboxCredentials = decrypted
	}
	return &config, nil
}

// ListConfigs returns all gateway configs for a seller (credential keys only, no values).
func (s *Store) ListConfigs(ctx context.Context, sellerID string) ([]GatewayConfigResponse, error) {
	cursor, err := s.configs.Find(ctx, bson.M{"sellerId": sellerID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var configs []GatewayConfig
	if err := cursor.All(ctx, &configs); err != nil {
		return nil, err
	}

	// last4 derives a per-field "last 4 chars" hint from already-loaded encrypted
	// credentials. Pure in-memory: same Find above carried these blobs in. Fail-open:
	// any decrypt error returns nil so the page still renders and saves still work.
	last4 := func(enc map[string]string) map[string]string {
		if len(enc) == 0 {
			return nil
		}
		plain, err := s.decryptCredentials(enc)
		if err != nil {
			return nil
		}
		out := make(map[string]string, len(plain))
		for k, v := range plain {
			if n := len(v); n >= 4 {
				out[k] = v[n-4:]
			}
		}
		return out
	}

	responses := make([]GatewayConfigResponse, len(configs))
	for i, c := range configs {
		credKeys := make([]string, 0, len(c.Credentials))
		for k := range c.Credentials {
			credKeys = append(credKeys, k)
		}
		sandboxKeys := make([]string, 0, len(c.SandboxCredentials))
		for k := range c.SandboxCredentials {
			sandboxKeys = append(sandboxKeys, k)
		}
		responses[i] = GatewayConfigResponse{
			ID:                     c.ID,
			SellerID:               c.SellerID,
			Gateway:                c.Gateway,
			DisplayName:            c.DisplayName,
			Sandbox:                c.Sandbox,
			CredentialKeys:         credKeys,
			SandboxCredentialKeys:  sandboxKeys,
			CredentialLast4:        last4(c.Credentials),
			SandboxCredentialLast4: last4(c.SandboxCredentials),
			CreatedAt:              c.CreatedAt,
			UpdatedAt:              c.UpdatedAt,
		}
	}
	return responses, nil
}

// DeleteConfig removes a gateway config.
func (s *Store) DeleteConfig(ctx context.Context, sellerID, gatewayName string) error {
	_, err := s.configs.DeleteOne(ctx, bson.M{"sellerId": sellerID, "gateway": gatewayName})
	return err
}

// CreateSession saves a new payment session.
func (s *Store) CreateSession(ctx context.Context, session *PaymentSession) error {
	session.ID = primitive.NewObjectID()
	session.CreatedAt = time.Now()
	session.ExpiresAt = time.Now().Add(30 * time.Minute)
	session.Status = "pending"
	_, err := s.sessions.InsertOne(ctx, session)
	return err
}

// GetSessionByProviderID retrieves a payment session by the provider's session ID.
func (s *Store) GetSessionByProviderID(ctx context.Context, providerSessionID string) (*PaymentSession, error) {
	var session PaymentSession
	err := s.sessions.FindOne(ctx, bson.M{"providerSessionId": providerSessionID}).Decode(&session)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// ClaimSession atomically transitions a payment session from "pending" to "processing".
// Returns the session only if the transition succeeded. Prevents duplicate order creation.
func (s *Store) ClaimSession(ctx context.Context, providerSessionID string) (*PaymentSession, error) {
	var session PaymentSession
	err := s.sessions.FindOneAndUpdate(
		ctx,
		bson.M{
			"providerSessionId": providerSessionID,
			"status":            "pending",
			"expiresAt":         bson.M{"$gt": time.Now()},
		},
		bson.M{"$set": bson.M{"status": "processing"}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&session)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// UpdateSessionStatus updates the status of a payment session.
func (s *Store) UpdateSessionStatus(ctx context.Context, id primitive.ObjectID, status string) error {
	_, err := s.sessions.UpdateByID(ctx, id, bson.M{"$set": bson.M{"status": status}})
	return err
}

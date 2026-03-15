package gateway

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// OfflineGateway handles payment methods that don't require online processing:
// pickup_&_pay, deliver_pay, purchase_order, bank_transfer, check.
type OfflineGateway struct{}

func NewOfflineGateway() *OfflineGateway {
	return &OfflineGateway{}
}

func (g *OfflineGateway) ValidateCredentials(credentials map[string]string) error {
	return nil
}

func (g *OfflineGateway) CreateSession(ctx context.Context, req SessionRequest) (*SessionResponse, error) {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return &SessionResponse{
		ProviderSessionID: fmt.Sprintf("offline_%d_%s", time.Now().UnixNano(), hex.EncodeToString(b)),
		RedirectURL:       "",
	}, nil
}

func (g *OfflineGateway) CompleteSession(ctx context.Context, providerSessionID string, _ string, amount float64, currency string, credentials map[string]string, sandbox bool) (*CompletionResponse, error) {
	return &CompletionResponse{
		TransactionID: providerSessionID,
		Status:        "pending",
		ProviderRef:   "",
	}, nil
}

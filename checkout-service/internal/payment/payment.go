package payment

import (
	"fmt"
	"strings"
	"time"
)

// PaymentService handles the payment processing logic.
type PaymentService struct{}

// NewPaymentService creates a new PaymentService.
func NewPaymentService() *PaymentService {
	return &PaymentService{}
}

// ProcessPayment simulates processing a payment from a specific payment gateway.
func (s *PaymentService) ProcessPayment(amount float64, method string, token string) (string, bool) {
	// In a real application, this would integrate with the respective payment gateway APIs.
	// For now, we'll use a simple mock implementation.

	switch strings.ToLower(method) {
	case "stripe":
		if token == "tok_stripe_valid" {
			transactionID := fmt.Sprintf("stripe_tx_%d", time.Now().UnixNano())
			fmt.Printf("Processing Stripe payment of $%.2f. Success. TxID: %s\n", amount, transactionID)
			return transactionID, true
		}
		fmt.Printf("Stripe payment of $%.2f failed. Invalid token.\n", amount)
		return "", false
	case "amazon_pay":
		if token == "amz_pay_valid" {
			transactionID := fmt.Sprintf("amazon_tx_%d", time.Now().UnixNano())
			fmt.Printf("Processing Amazon Pay payment of $%.2f. Success. TxID: %s\n", amount, transactionID)
			return transactionID, true
		}
		fmt.Printf("Amazon Pay payment of $%.2f failed. Invalid token.\n", amount)
		return "", false
	default:
		fmt.Printf("Unsupported payment method: %s\n", method)
		return "", false
	}
}

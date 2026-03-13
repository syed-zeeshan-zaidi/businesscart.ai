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
	case "stripe", "stripe_pay":
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
	case "pickup_&_pay", "deliver_pay":
		transactionID := fmt.Sprintf("offline_tx_%d", time.Now().UnixNano())
		fmt.Printf("Processing offline payment of $%.2f. Marked as pending. TxID: %s\n", amount, transactionID)
		return transactionID, true
	case "credit_card":
		if token == "tok_stripe_valid" || token == "tok_placeholder" {
			transactionID := fmt.Sprintf("cc_tx_%d", time.Now().UnixNano())
			fmt.Printf("Processing credit card payment of $%.2f. Success. TxID: %s\n", amount, transactionID)
			return transactionID, true
		}
		return "", false
	case "google_pay":
		transactionID := fmt.Sprintf("gpay_tx_%d", time.Now().UnixNano())
		fmt.Printf("Processing Google Pay payment of $%.2f. Success. TxID: %s\n", amount, transactionID)
		return transactionID, true
	case "purchase_order":
		transactionID := fmt.Sprintf("po_tx_%d", time.Now().UnixNano())
		fmt.Printf("Processing Purchase Order payment of $%.2f. Marked as pending. TxID: %s\n", amount, transactionID)
		return transactionID, true
	default:
		fmt.Printf("Unsupported payment method: %s\n", method)
		return "", false
	}
}

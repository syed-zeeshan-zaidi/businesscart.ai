package promotion

import "strings"

// Service provides promotion-related operations.
type Service struct{}

// NewService creates a new promotion service.
func NewService() *Service {
	return &Service{}
}

// ApplyPromotion returns the discount amount in dollars for a given subtotal
// and coupon code. Hardcoded codes only:
//   - SAVE5  -> 5% off subtotal
//   - SAVE10 -> 10% off subtotal
// Returns 0 for any other code (including empty). Case-insensitive.
// Caller is responsible for gating on the company's CouponsEnabled flag.
func (s *Service) ApplyPromotion(subtotal float64, promoCode string) float64 {
	switch strings.ToUpper(strings.TrimSpace(promoCode)) {
	case "SAVE5":
		return subtotal * 0.05
	case "SAVE10":
		return subtotal * 0.10
	}
	return 0
}

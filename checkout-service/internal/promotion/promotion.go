package promotion

// Service provides promotion-related operations.
type Service struct{}

// NewService creates a new promotion service.
func NewService() *Service {
	return &Service{}
}

// ApplyPromotion applies a promotion to a subtotal.
func (s *Service) ApplyPromotion(subtotal float64, promoCode string) float64 {
	if promoCode == "SAVE10" {
		return subtotal * 0.10
	}
	return 0
}

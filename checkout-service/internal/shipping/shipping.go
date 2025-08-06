package shipping

// Service provides shipping-related operations.
type Service struct{}

// NewService creates a new shipping service.
func NewService() *Service {
	return &Service{}
}

// CalculateShipping calculates the shipping cost for a subtotal.
func (s *Service) CalculateShipping(subtotal float64) float64 {
	return 5.00
}
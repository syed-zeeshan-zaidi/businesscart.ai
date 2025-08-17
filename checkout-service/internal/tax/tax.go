package tax

// Service provides tax-related operations.
type Service struct{}

// NewService creates a new tax service.
func NewService() *Service {
	return &Service{}
}

// CalculateTax calculates the tax on a subtotal.
func (s *Service) CalculateTax(subtotal float64) float64 {
	return subtotal * 0.10
}

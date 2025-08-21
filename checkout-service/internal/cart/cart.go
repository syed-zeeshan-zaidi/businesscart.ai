package cart

import (
	"context"
	"errors"
	"log"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Service provides cart-related operations.
type Service struct {
	collection *mongo.Collection
}

// NewService creates a new cart service.
func NewService(db *mongo.Database) *Service {
	return &Service{collection: db.Collection("carts")}
}

// GetCart retrieves a user's cart for a specific company.
func (s *Service) GetCart(accountID, sellerID string) (*Cart, error) {
	var cart Cart
	err := s.collection.FindOne(context.TODO(), bson.M{"accountId": accountID, "sellerId": sellerID}).Decode(&cart)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("cart not found")
		}
		return nil, err
	}
	cart.TotalPrice = s.calculateTotalPrice(cart)
	return &cart, nil
}

// ClearCart removes all items from a user's cart for a specific company.
func (s *Service) ClearCart(accountID, sellerID string) error {
	_, err := s.collection.UpdateOne(
		context.TODO(),
		bson.M{"accountId": accountID, "sellerId": sellerID},
		bson.M{"$set": bson.M{"items": []CartItem{}}},
	)
	return err
}

// SaveCart saves a cart to the database. If the cart already exists, it updates it.
func (s *Service) SaveCart(cart *Cart) error {
	log.Printf("Attempting to save cart for user %s, company %s", cart.AccountID, cart.SellerID)
	cart.TotalPrice = s.calculateTotalPrice(*cart)
	result, err := s.collection.UpdateOne(
		context.TODO(),
		bson.M{"accountId": cart.AccountID, "sellerId": cart.SellerID},
		bson.M{"$set": cart},
		options.Update().SetUpsert(true),
	)
	if err != nil {
		log.Printf("Error saving cart: %v", err)
		return err
	}
	log.Printf("Cart save result: %+v", result)
	return nil
}

func (s *Service) calculateTotalPrice(cart Cart) float64 {
	var total float64
	for _, item := range cart.Items {
		total += item.Price * float64(item.Quantity)
	}
	return total
}

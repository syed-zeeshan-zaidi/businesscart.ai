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
	s.calculateTotals(&cart)
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
	s.calculateTotals(cart)
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

// SaveList snapshots the current main cart items into a named saved list ("Requisition
// List / Saved Cart"). Overwrites an existing list of the same name; caps at 3 lists.
func (s *Service) SaveList(accountID, sellerID, name string) error {
	cart, err := s.GetCart(accountID, sellerID)
	if err != nil {
		return err
	}
	if len(cart.Items) == 0 {
		return errors.New("cart is empty")
	}
	for i := range cart.SavedLists {
		if cart.SavedLists[i].Name == name {
			cart.SavedLists[i].Items = cart.Items
			return s.SaveCart(cart)
		}
	}
	if len(cart.SavedLists) >= 3 {
		return errors.New("maximum of 3 saved carts per company")
	}
	cart.SavedLists = append(cart.SavedLists, SavedList{Name: name, Items: cart.Items})
	return s.SaveCart(cart)
}

// DeleteList removes a named saved list from the cart.
func (s *Service) DeleteList(accountID, sellerID, name string) error {
	cart, err := s.GetCart(accountID, sellerID)
	if err != nil {
		return err
	}
	kept := cart.SavedLists[:0]
	for _, l := range cart.SavedLists {
		if l.Name != name {
			kept = append(kept, l)
		}
	}
	cart.SavedLists = kept
	return s.SaveCart(cart)
}

func (s *Service) calculateTotals(cart *Cart) {
	var total float64
	for i := range cart.Items {
		item := &cart.Items[i]
		price := item.Price
		if item.DiscountedPrice > 0 {
			price = item.DiscountedPrice
		}
		item.LineItemTotal = price * float64(item.Quantity)
		total += item.LineItemTotal
	}
	cart.TotalPrice = total
}

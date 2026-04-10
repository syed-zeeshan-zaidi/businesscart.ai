package order

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	collection      *mongo.Collection
	usersCollection *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		collection:      db.Collection("orders"),
		usersCollection: db.Collection("users"),
	}
}

func (s *Service) CreateOrder(order *Order) (*Order, error) {
	order.CreatedAt = time.Now()
	order.Status = "pending" // Initialize status to "pending"
	_, err := s.collection.InsertOne(context.Background(), order)
	if err != nil {
		return nil, err
	}
	return order, nil
}

// GetUnpaidOrdersTotal returns the sum of grandTotal for all non-cancelled orders for a customer+seller pair.
func (s *Service) GetUnpaidOrdersTotal(accountID, sellerID string) (float64, error) {
	pipeline := []bson.M{
		{"$match": bson.M{"accountId": accountID, "sellerId": sellerID, "status": bson.M{"$ne": "cancelled"}}},
		{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$grandTotal"}}},
	}
	cursor, err := s.collection.Aggregate(context.Background(), pipeline)
	if err != nil {
		return 0, err
	}
	defer cursor.Close(context.Background())

	var result []struct {
		Total float64 `bson:"total"`
	}
	if err = cursor.All(context.Background(), &result); err != nil {
		return 0, err
	}
	if len(result) == 0 {
		return 0, nil
	}
	return result[0].Total, nil
}

// CountOrdersSince returns the number of non-cancelled orders for a customer+seller since a given time.
func (s *Service) CountOrdersSince(accountID, sellerID string, since time.Time) (int64, error) {
	filter := bson.M{
		"accountId": accountID,
		"sellerId":  sellerID,
		"status":    bson.M{"$ne": "cancelled"},
		"createdAt": bson.M{"$gte": since},
	}
	return s.collection.CountDocuments(context.Background(), filter)
}

func (s *Service) DeleteOrder(id primitive.ObjectID) error {
	_, err := s.collection.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

func (s *Service) GetOrders(userId string, role string, companyId string) ([]*Order, error) {
	filter := bson.M{}

	switch role {
	case "admin":
		// No filter needed for admin, they see all orders
	case "company":
		filter = bson.M{"sellerId": companyId}
	case "customer", "b2c":
		filter = bson.M{"accountId": userId}
	default:
		// For any other role, or if role is not set, return no orders
		return []*Order{}, nil
	}

	cursor, err := s.collection.Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var orders []*Order
	if err = cursor.All(context.Background(), &orders); err != nil {
		return nil, err
	}
	return orders, nil
}

package order

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	collection *mongo.Collection
	usersCollection *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		collection: db.Collection("orders"),
		usersCollection: db.Collection("users"),
	}
}

func (s *Service) CreateOrder(order *Order) (*Order, error) {
	order.CreatedAt = time.Now()
	_, err := s.collection.InsertOne(context.Background(), order)
	if err != nil {
		return nil, err
	}
	return order, nil
}

func (s *Service) GetOrders(userId string, role string, companyId string) ([]*Order, error) {
	filter := bson.M{}

	switch role {
	case "admin":
		// No filter needed for admin, they see all orders
	case "customer":
		filter = bson.M{"userId": userId}
	case "company":
		// For company users, find all customers associated with their companyId
		var associatedCustomers []struct { ID string `bson:"_id"` }
		cursor, err := s.usersCollection.Find(context.Background(), bson.M{"company_id": companyId, "role": "customer"})
		if err != nil {
			return nil, err
		}
		defer cursor.Close(context.Background())

		if err = cursor.All(context.Background(), &associatedCustomers); err != nil {
			return nil, err
		}

		var customerIds []string
		for _, customer := range associatedCustomers {
			customerIds = append(customerIds, customer.ID)
		}

		if len(customerIds) > 0 {
			filter = bson.M{"userId": bson.M{"$in": customerIds}}
		} else {
			// If no associated customers, return no orders
			return []*Order{}, nil
		}
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

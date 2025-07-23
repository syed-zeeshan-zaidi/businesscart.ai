package order

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	collection *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		collection: db.Collection("orders"),
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

package quote

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Service struct {
	collection *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		collection: db.Collection("quotes"),
	}
}

func (s *Service) CreateQuote(quote *Quote) error {
	quote.ID = primitive.NewObjectID()
	quote.CreatedAt = time.Now()
	quote.ExpiresAt = time.Now().Add(24 * time.Hour) // Quotes expire in 24 hours
	_, err := s.collection.InsertOne(context.Background(), quote)
	return err
}

func (s *Service) GetQuote(quoteID primitive.ObjectID) (*Quote, error) {
	var quote Quote
	err := s.collection.FindOne(context.Background(), bson.M{"_id": quoteID}).Decode(&quote)
	if err != nil {
		return nil, err
	}
	return &quote, nil
}

func (s *Service) DeleteQuote(quoteID string) error {
	objID, err := primitive.ObjectIDFromHex(quoteID)
	if err != nil {
		return err
	}
	_, err = s.collection.DeleteOne(context.Background(), bson.M{"_id": objID})
	return err
}

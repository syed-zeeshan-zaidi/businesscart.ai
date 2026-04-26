package statement

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Service struct {
	collection *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{collection: db.Collection("statements")}
}

// Save inserts a new statement snapshot. Returns the inserted document with
// its assigned ID.
func (s *Service) Save(stmt *Statement) (*Statement, error) {
	res, err := s.collection.InsertOne(context.Background(), stmt)
	if err != nil {
		return nil, err
	}
	if oid, ok := res.InsertedID.(interface{}); ok {
		_ = oid
	}
	return stmt, nil
}

// ListBySeller returns sent statements for a seller, newest first.
// limit=0 means no limit.
func (s *Service) ListBySeller(sellerID string, limit int64) ([]*Statement, error) {
	opts := options.Find().SetSort(bson.D{{Key: "sentAt", Value: -1}})
	if limit > 0 {
		opts.SetLimit(limit)
	}
	cursor, err := s.collection.Find(context.Background(), bson.M{"sellerId": sellerID}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.Background())

	var out []*Statement
	if err := cursor.All(context.Background(), &out); err != nil {
		return nil, err
	}
	return out, nil
}

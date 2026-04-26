package statement

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Service struct {
	collection *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{collection: db.Collection("statements")}
}

// Save inserts a new statement snapshot. The mongo driver returns the new
// _id but does NOT write it back to the struct, so we copy it ourselves —
// callers (handler response, test cleanup) need a usable id.
func (s *Service) Save(stmt *Statement) (*Statement, error) {
	res, err := s.collection.InsertOne(context.Background(), stmt)
	if err != nil {
		return nil, err
	}
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		stmt.ID = oid
	}
	return stmt, nil
}

// Delete removes a statement by ID. Admin retraction path (a statement was
// sent in error). Returns true if a doc was deleted.
func (s *Service) Delete(id primitive.ObjectID) (bool, error) {
	res, err := s.collection.DeleteOne(context.Background(), bson.M{"_id": id})
	if err != nil {
		return false, err
	}
	return res.DeletedCount > 0, nil
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

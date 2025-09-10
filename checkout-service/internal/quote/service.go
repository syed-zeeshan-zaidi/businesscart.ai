package quote

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Service struct {
	collection *mongo.Collection
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		collection: db.Collection("quotes"),
	}
}

func (s *Service) CreateQuote(quote *Quote) (*Quote, error) {
	filter := bson.M{
		"accountId": quote.AccountID,
		"sellerId":  quote.SellerID,
	}

	update := bson.M{
		"$set": bson.M{
			"items":                       quote.Items,
			"subtotal":                    quote.Subtotal,
			"shippingCost":                quote.ShippingCost,
			"taxAmount":                   quote.TaxAmount,
			"grandTotal":                  quote.GrandTotal,
			"availablePaymentMethods":     quote.AvailablePaymentMethods,
			"availableDeliveryMethods":    quote.AvailableDeliveryMethods,
			"availableShippingOutOptions": quote.AvailableShippingOutOptions,
			"companyLocations":            quote.CompanyLocations,
			"cartId":                      quote.CartID,
			"expiresAt":                   time.Now().Add(24 * time.Hour),
		},
		"$setOnInsert": bson.M{
			"_id":       primitive.NewObjectID(),
			"createdAt": time.Now(),
		},
	}

	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)

	var updatedQuote Quote
	err := s.collection.FindOneAndUpdate(context.Background(), filter, update, opts).Decode(&updatedQuote)
	if err != nil {
		return nil, err
	}

	return &updatedQuote, nil
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

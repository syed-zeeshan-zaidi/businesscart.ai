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
			"customerAddresses":           quote.CustomerAddresses,
			"cartId":                      quote.CartID,
			"expiresAt":                   time.Now().Add(24 * time.Hour),
			"quoteType":                   quote.QuoteType,
			"status":                      quote.Status,
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

// GetQuotesByAccountID retrieves all quotes for a given account ID.
func (s *Service) GetQuotesByAccountID(ctx context.Context, accountID string, sellerID string) ([]Quote, error) {
	var quotes []Quote
	filter := bson.M{"accountId": accountID}
	if sellerID != "" {
		filter["sellerId"] = sellerID
	}
	cursor, err := s.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &quotes); err != nil {
		return nil, err
	}
	return quotes, nil
}

// GetQuotesBySellerID retrieves all quotes for a given seller ID.
func (s *Service) GetQuotesBySellerID(ctx context.Context, sellerID string) ([]Quote, error) {
	var quotes []Quote
	filter := bson.M{}
	if sellerID != "" {
		filter["sellerId"] = sellerID
	}
	cursor, err := s.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &quotes); err != nil {
		return nil, err
	}
	return quotes, nil
}

// ProposedChange represents a proposed change to a quote item.

type ProposedChange struct {
	ItemID        string  `json:"itemId"`
	ProposedPrice float64 `json:"proposedPrice"`
}

// ProposeChanges updates a quote with proposed changes from the customer.
func (s *Service) ProposeChanges(quoteID primitive.ObjectID, changes []ProposedChange) (*Quote, error) {
	quote, err := s.GetQuote(quoteID)
	if err != nil {
		return nil, err
	}

	// Create a map of item ID to proposed price for easy lookup
	changeMap := make(map[string]float64)
	for _, change := range changes {
		changeMap[change.ItemID] = change.ProposedPrice
	}

	// Update the items in the quote
	for i, item := range quote.Items {
		if proposedPrice, ok := changeMap[item.ID.Hex()]; ok {
			quote.Items[i].ProposedPrice = proposedPrice
		}
	}

	// Update the quote status and history
	quote.Status = "proposed"
	quote.History = append(quote.History, QuoteHistory{
		Status:    "proposed",
		ChangedAt: time.Now(),
	})

	// Save the updated quote
	filter := bson.M{"_id": quoteID}
	update := bson.M{"$set": quote}
	_, err = s.collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return nil, err
	}

	return quote, nil
}

// UpdateQuoteStatus updates a quote's status.
func (s *Service) UpdateQuoteStatus(quoteID primitive.ObjectID, status string) (*Quote, error) {
	quote, err := s.GetQuote(quoteID)
	if err != nil {
		return nil, err
	}

	quote.Status = status
	quote.History = append(quote.History, QuoteHistory{
		Status:    status,
		ChangedAt: time.Now(),
	})

	if status == "approved" {
		// When a quote is approved, the proposed prices become the actual prices.
		for i, item := range quote.Items {
			if item.ProposedPrice > 0 {
				quote.Items[i].Price = item.ProposedPrice
				quote.Items[i].ProposedPrice = 0 // Clear the proposed price
			}
		}

		// Recalculate totals
		var subtotal float64
		for _, item := range quote.Items {
			subtotal += item.Price * float64(item.Quantity)
		}
		quote.Subtotal = subtotal
		quote.GrandTotal = quote.Subtotal + quote.ShippingCost + quote.TaxAmount
	}

	filter := bson.M{"_id": quoteID}
	update := bson.M{"$set": quote}
	_, err = s.collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return nil, err
	}

	return quote, nil
}

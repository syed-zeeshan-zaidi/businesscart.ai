package quote

import (
	"context"
	"fmt"
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
	var filter bson.M

	if quote.QuoteType == "negotiable" {
		// For negotiable quotes, only update if a 'draft' exists. Otherwise, create a new one.
		// This protects active quotes (e.g., 'open', 'proposed') from being overwritten.
		filter = bson.M{
			"accountId": quote.AccountID,
			"sellerId":  quote.SellerID,
			"status":    "draft",
		}
	} else {
		// For standard quotes, find and overwrite any existing quote for the same customer/seller.
		filter = bson.M{
			"accountId": quote.AccountID,
			"sellerId":  quote.SellerID,
			"quoteType": "standard",
		}
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
			"discountPercentage":          quote.DiscountPercentage,
			"discountAmount":              quote.DiscountAmount,
			"notes":                       quote.Notes,
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

// CustomerPropose updates a quote with proposed changes from the customer.
func (s *Service) CustomerPropose(quoteID primitive.ObjectID, changes []ProposedChange) (*Quote, error) {
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
		quote.GrandTotal = quote.Subtotal - quote.DiscountAmount + quote.ShippingCost + quote.TaxAmount
	}

	filter := bson.M{"_id": quoteID}
	update := bson.M{"$set": quote}
	_, err = s.collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return nil, err
	}

	return quote, nil
}

// AddComment adds a comment to a quote.
func (s *Service) AddComment(quoteID primitive.ObjectID, accountID string, text string) (*Quote, error) {
	comment := Comment{
		ID:        primitive.NewObjectID(),
		AccountID: accountID,
		Text:      text,
		CreatedAt: time.Now(),
	}

	filter := bson.M{"_id": quoteID}
	update := bson.M{
		"$push": bson.M{
			"comments": comment,
		},
	}

	opts := options.FindOneAndUpdate().SetReturnDocument(options.After)

	var updatedQuote Quote
	err := s.collection.FindOneAndUpdate(context.Background(), filter, update, opts).Decode(&updatedQuote)
	if err != nil {
		return nil, err
	}

	return &updatedQuote, nil
}

// ApplyQuoteDiscount applies a percentage discount to the entire quote.
func (s *Service) ApplyQuoteDiscount(quoteID primitive.ObjectID, discountPercentage float64, accountID string) (*Quote, error) {
	quote, err := s.GetQuote(quoteID)
	if err != nil {
		return nil, err
	}

	if discountPercentage < 0 || discountPercentage > 100 {
		return nil, fmt.Errorf("discount percentage must be between 0 and 100")
	}

	// Calculate discount amount
	discountAmount := quote.Subtotal * (discountPercentage / 100)

	// Apply discount and recalculate totals
	quote.DiscountPercentage = discountPercentage
	quote.DiscountAmount = discountAmount
	quote.GrandTotal = quote.Subtotal - discountAmount + quote.ShippingCost + quote.TaxAmount

	// Add to history
	quote.History = append(quote.History, QuoteHistory{
		Status:    fmt.Sprintf("discount_applied_%.2f%%", discountPercentage),
		ChangedAt: time.Now(),
	})

	filter := bson.M{"_id": quoteID}
	update := bson.M{"$set": quote}
	_, err = s.collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return nil, err
	}

	return quote, nil
}

// UpdateQuoteBySeller updates a quote with changes from the seller.
type SellerUpdate struct {
	Items           []ItemUpdate `json:"items,omitempty"`
	NewShippingCost *float64     `json:"newShippingCost,omitempty"`
	Notes           *string      `json:"notes,omitempty"`
}

type ItemUpdate struct {
	ItemID   string  `json:"itemId"`
	Quantity *int    `json:"quantity,omitempty"`
	Price    *float64 `json:"price,omitempty"`
}

func (s *Service) UpdateQuoteBySeller(quoteID primitive.ObjectID, updates SellerUpdate, accountID string) (*Quote, error) {
	quote, err := s.GetQuote(quoteID)
	if err != nil {
		return nil, err
	}

	// Apply item updates
	for _, itemUpdate := range updates.Items {
		found := false
		for i, item := range quote.Items {
			if item.ID.Hex() == itemUpdate.ItemID {
				if itemUpdate.Quantity != nil {
					quote.Items[i].Quantity = *itemUpdate.Quantity
				}
				if itemUpdate.Price != nil {
					quote.Items[i].Price = *itemUpdate.Price
				}
				// Recalculate line item total
				quote.Items[i].LineItemTotal = quote.Items[i].Price * float64(quote.Items[i].Quantity)
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("item with ID %s not found in quote", itemUpdate.ItemID)
		}
	}

	// Apply new shipping cost
	if updates.NewShippingCost != nil {
		quote.ShippingCost = *updates.NewShippingCost
	}

	// Apply notes
	if updates.Notes != nil {
		quote.Notes = *updates.Notes
	}

	// Recalculate totals
	var subtotal float64
	for _, item := range quote.Items {
		subtotal += item.LineItemTotal
	}
	quote.Subtotal = subtotal
	// Apply discount if any
	quote.DiscountAmount = quote.Subtotal * (quote.DiscountPercentage / 100)
	quote.GrandTotal = quote.Subtotal - quote.DiscountAmount + quote.ShippingCost + quote.TaxAmount

	// Add to history
	quote.History = append(quote.History, QuoteHistory{
		Status:    "seller_updated",
		ChangedAt: time.Now(),
	})

	filter := bson.M{"_id": quoteID}
	update := bson.M{"$set": quote}
	_, err = s.collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return nil, err
	}

	return quote, nil
}

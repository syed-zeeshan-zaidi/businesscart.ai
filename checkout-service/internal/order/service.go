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

// CountOrdersForSellerSince returns the number of non-cancelled orders for a
// seller since a given time, across all customers. Used by statement generation
// to compute monthly tier and per-order fees.
func (s *Service) CountOrdersForSellerSince(sellerID string, since time.Time) (int64, error) {
	filter := bson.M{
		"sellerId":  sellerID,
		"status":    bson.M{"$ne": "cancelled"},
		"createdAt": bson.M{"$gte": since},
	}
	return s.collection.CountDocuments(context.Background(), filter)
}

// GetSellerOrdersInPeriod returns non-cancelled orders for a seller within a
// time window [from, to). Used by statement generation to compute period
// totals and per-order capped fees (e.g., Starter tier $5/order cap).
func (s *Service) GetSellerOrdersInPeriod(sellerID string, from, to time.Time) ([]*Order, error) {
	filter := bson.M{
		"sellerId": sellerID,
		"status":   bson.M{"$ne": "cancelled"},
		"createdAt": bson.M{
			"$gte": from,
			"$lt":  to,
		},
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

// GetOrdersForExport returns orders within [from, to) for the seller, with
// format-specific filters layered on:
//   - "generic": all orders in the window (including cancelled). Use for
//     accounting reconciliation, monthly reports, tax filings.
//   - "google":  non-cancelled orders carrying a gclid (Google Ads offline
//     conversion upload; cancelled orders would corrupt ROAS bidding).
//   - "bing":    non-cancelled orders carrying an msclkid.
//
// Optional sellerID scopes to one seller (empty = all sellers, admin only).
func (s *Service) GetOrdersForExport(sellerID, format string, from, to time.Time) ([]*Order, error) {
	filter := bson.M{
		"createdAt": bson.M{"$gte": from, "$lt": to},
	}
	if sellerID != "" {
		filter["sellerId"] = sellerID
	}
	switch format {
	case "generic":
		// No additional filter: full ledger view.
	case "google":
		filter["status"] = bson.M{"$ne": "cancelled"}
		// Google's legacy CSV file upload accepts only gclid; gbraid/wbraid
		// require the Google Ads API (Enhanced Conversions).
		filter["clickIds.gclid"] = bson.M{"$exists": true, "$ne": ""}
	case "bing":
		filter["status"] = bson.M{"$ne": "cancelled"}
		filter["clickIds.msclkid"] = bson.M{"$exists": true, "$ne": ""}
	default:
		return nil, nil
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

func (s *Service) DeleteOrder(id primitive.ObjectID) error {
	_, err := s.collection.DeleteOne(context.Background(), bson.M{"_id": id})
	return err
}

func (s *Service) GetByID(id primitive.ObjectID) (*Order, error) {
	var o Order
	err := s.collection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&o)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

type OrderUpdate struct {
	Status            string
	TrackingNumber    string
	TrackingCarrier   string
	TrackingURL       string
	SetReviewRequested bool // when true, sets reviewRequestedAt = now
}

func (s *Service) UpdateOrder(id primitive.ObjectID, update OrderUpdate) (*Order, error) {
	current, err := s.GetByID(id)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	set := bson.M{"updatedAt": now}
	if update.Status != "" {
		set["status"] = update.Status
		if update.Status == "shipped" && current.ShippedAt == nil {
			set["shippedAt"] = now
		}
		if update.Status == "delivered" && current.DeliveredAt == nil {
			set["deliveredAt"] = now
		}
	}
	if update.TrackingNumber != "" {
		set["trackingNumber"] = update.TrackingNumber
	}
	if update.TrackingCarrier != "" {
		set["trackingCarrier"] = update.TrackingCarrier
	}
	if update.TrackingURL != "" {
		set["trackingUrl"] = update.TrackingURL
	}
	if update.SetReviewRequested {
		set["reviewRequestedAt"] = now
	}
	_, err = s.collection.UpdateOne(context.Background(), bson.M{"_id": id}, bson.M{"$set": set})
	if err != nil {
		return nil, err
	}
	return s.GetByID(id)
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

package order

import (
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// DeliveryAddress is a snapshot of the shipping address at order-create time.
// Stamped from the request body so order detail views can render the full
// address without joining back to account-service's customer_addresses
// collection (which may be edited or deleted by the customer post-order).
type DeliveryAddress struct {
	RecipientName string `bson:"recipientName,omitempty" json:"recipientName,omitempty"`
	Street        string `bson:"street,omitempty" json:"street,omitempty"`
	City          string `bson:"city,omitempty" json:"city,omitempty"`
	State         string `bson:"state,omitempty" json:"state,omitempty"`
	Zip           string `bson:"zip,omitempty" json:"zip,omitempty"`
	PhoneNumber   string `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
}

type Order struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	QuoteID           primitive.ObjectID `bson:"quoteId" json:"quoteId"`
	AccountID         string             `bson:"accountId" json:"accountId"`
	SellerID          string             `bson:"sellerId" json:"sellerId"`
	Items             []cart.CartItem    `bson:"items" json:"items"`
	Subtotal          float64            `bson:"subtotal" json:"subtotal"`
	ShippingCost      float64            `bson:"shippingCost" json:"shippingCost"`
	TaxAmount         float64            `bson:"taxAmount" json:"taxAmount"`
	GrandTotal        float64            `bson:"grandTotal" json:"grandTotal"`
	PaymentMethod     string             `bson:"paymentMethod" json:"paymentMethod"`
	DeliveryMethod    string             `bson:"deliveryMethod" json:"deliveryMethod"`
	TransactionID     string             `bson:"transactionId" json:"transactionId"`
	PickupLocationID  string             `bson:"pickupLocationId,omitempty" json:"pickupLocationId,omitempty"`
	DeliveryAddressID string             `bson:"deliveryAddressId,omitempty" json:"deliveryAddressId,omitempty"`
	DeliveryAddress   *DeliveryAddress   `bson:"deliveryAddress,omitempty" json:"deliveryAddress,omitempty"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	Status            string             `bson:"status" json:"status"`
	CustomerEmail     string             `bson:"customerEmail,omitempty" json:"customerEmail,omitempty"`
	TrackingNumber    string             `bson:"trackingNumber,omitempty" json:"trackingNumber,omitempty"`
	TrackingCarrier   string             `bson:"trackingCarrier,omitempty" json:"trackingCarrier,omitempty"`
	TrackingURL       string             `bson:"trackingUrl,omitempty" json:"trackingUrl,omitempty"`
	ShippedAt         *time.Time         `bson:"shippedAt,omitempty" json:"shippedAt,omitempty"`
	DeliveredAt       *time.Time         `bson:"deliveredAt,omitempty" json:"deliveredAt,omitempty"`
	ReviewRequestedAt *time.Time         `bson:"reviewRequestedAt,omitempty" json:"reviewRequestedAt,omitempty"`
	UpdatedAt         *time.Time         `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
	VisitorID         string             `bson:"visitorId,omitempty" json:"visitorId,omitempty"`
	ClickIDs          map[string]string  `bson:"clickIds,omitempty" json:"clickIds,omitempty"`
	// Denormalized from Quote at order-create time. Required so admin order
	// detail, CSV exports, and the order confirmation email can show the
	// breakdown without joining back to the quote (which may be gone).
	PromoCode         string             `bson:"promoCode,omitempty" json:"promoCode,omitempty"`
	PromoDiscount     float64            `bson:"promoDiscount,omitempty" json:"promoDiscount,omitempty"`

	// Refunds: append-only sub-collection. Items[] and money fields above stay
	// immutable as the order-of-record. Refunds track money returned (matches
	// Shopify/WooCommerce/Stripe industry pattern). Status field auto-set to
	// "refunded" only when a refund makes the sum equal to GrandTotal.
	Refunds []Refund `bson:"refunds,omitempty" json:"refunds,omitempty"`
}

// Refund is a single refund event against an order. Each refund corresponds to
// a manual Stripe refund (we store the Stripe refund ID for traceability but
// do not call Stripe). Multiple refunds per order are supported.
type Refund struct {
	ID              primitive.ObjectID     `bson:"_id" json:"id"`
	StripeRefundID  string                 `bson:"stripeRefundID" json:"stripeRefundID"`
	Amount          float64                `bson:"amount" json:"amount"`
	Reason          string                 `bson:"reason,omitempty" json:"reason,omitempty"`
	ItemAdjustments []RefundItemAdjustment `bson:"itemAdjustments,omitempty" json:"itemAdjustments,omitempty"`
	RefundedAt      time.Time              `bson:"refundedAt" json:"refundedAt"`
	RefundedBy      string                 `bson:"refundedBy,omitempty" json:"refundedBy,omitempty"`
}

// RefundItemAdjustment tracks which items + qty were returned for a refund.
// Optional: an admin can record a money-only refund (e.g. shipping/tax dispute)
// without itemizing.
type RefundItemAdjustment struct {
	ProductID  string  `bson:"productID" json:"productID"`
	Quantity   int     `bson:"quantity" json:"quantity"`
	LineAmount float64 `bson:"lineAmount" json:"lineAmount"`
}

// TotalRefunded sums all refund amounts. Returns 0 if no refunds.
func (o *Order) TotalRefunded() float64 {
	total := 0.0
	for _, r := range o.Refunds {
		total += r.Amount
	}
	return total
}

// NetTotal is the customer-paid amount after refunds. Downstream consumers
// (statements, CSV exports, conversion attribution) should use NetTotal, not
// GrandTotal, once refunds exist.
func (o *Order) NetTotal() float64 {
	net := o.GrandTotal - o.TotalRefunded()
	if net < 0 {
		return 0
	}
	return net
}

// RefundStatus is the aggregate refund state. Empty when no refunds.
// "partial" when refunds exist but total < GrandTotal.
// "full" when refund total equals or exceeds GrandTotal.
func (o *Order) RefundStatus() string {
	if len(o.Refunds) == 0 {
		return ""
	}
	if o.TotalRefunded() >= o.GrandTotal {
		return "full"
	}
	return "partial"
}

// KeepOnlyItemsForPartner strips items whose PartnerID does not match partnerID.
// Used when returning orders to a partner-role viewer on mixed-supplier orders.
// Money fields (GrandTotal, Subtotal, TaxAmount) are the whole-order values and
// stay untouched; UI shows N/A for those to partners.
func (o *Order) KeepOnlyItemsForPartner(partnerID string) {
	kept := o.Items[:0]
	for _, it := range o.Items {
		if it.PartnerID == partnerID {
			kept = append(kept, it)
		}
	}
	o.Items = kept
}

// Package statement owns billing-statement persistence + computation.
//
// A Statement is the billing artifact admin sends to a seller for a period.
// Computation is a pure function of orders; persistence happens only when admin
// actually sends the email (forward-only snapshots, never recompute on top of
// stored docs).
package statement

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Statement is the persisted billing snapshot. Fields with omitempty are either
// not yet set (PaidAt, PaymentReference) or optional context (CompanyName,
// PaymentInstructions, SentByAdminID). Reserved fields exist now so future
// payment-tracking work doesn't need a migration.
type Statement struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SellerID            string             `bson:"sellerId" json:"sellerId"`
	PeriodStart         time.Time          `bson:"periodStart" json:"periodStart"`
	PeriodEnd           time.Time          `bson:"periodEnd" json:"periodEnd"`
	PeriodLabel         string             `bson:"periodLabel,omitempty" json:"periodLabel,omitempty"`
	OrderCount          int                `bson:"orderCount" json:"orderCount"`
	TotalGrandTotal     float64            `bson:"totalGrandTotal" json:"totalGrandTotal"`
	Tier                string             `bson:"tier" json:"tier"`
	MonthlyFee          float64            `bson:"monthlyFee" json:"monthlyFee"`
	PerOrderRate        float64            `bson:"perOrderRate" json:"perOrderRate"`
	PerOrderCap         *float64           `bson:"perOrderCap,omitempty" json:"perOrderCap,omitempty"`
	TransactionFees     float64            `bson:"transactionFees" json:"transactionFees"`
	TotalDue            float64            `bson:"totalDue" json:"totalDue"`
	RecipientEmail      string             `bson:"recipientEmail" json:"recipientEmail"`
	CompanyName         string             `bson:"companyName,omitempty" json:"companyName,omitempty"`
	PaymentInstructions string             `bson:"paymentInstructions,omitempty" json:"paymentInstructions,omitempty"`
	SentAt              time.Time          `bson:"sentAt" json:"sentAt"`
	SentByAdminID       string             `bson:"sentByAdminId,omitempty" json:"sentByAdminId,omitempty"`
	PaidAt              *time.Time         `bson:"paidAt,omitempty" json:"paidAt,omitempty"`
	PaymentReference    string             `bson:"paymentReference,omitempty" json:"paymentReference,omitempty"`
}

// Computed is the in-memory derivation produced by Compute (no persistence
// fields). Used for previews and current-month displays.
type Computed struct {
	SellerID        string    `json:"sellerId"`
	PeriodStart     time.Time `json:"periodStart"`
	PeriodEnd       time.Time `json:"periodEnd"`
	OrderCount      int       `json:"orderCount"`
	TotalGrandTotal float64   `json:"totalGrandTotal"`
	Tier            string    `json:"tier"`
	MonthlyFee      float64   `json:"monthlyFee"`
	PerOrderRate    float64   `json:"perOrderRate"`
	PerOrderCap     *float64  `json:"perOrderCap,omitempty"`
	TransactionFees float64   `json:"transactionFees"`
	TotalDue        float64   `json:"totalDue"`
}

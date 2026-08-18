package quote

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Service struct {
	collection *mongo.Collection
}

// roundCents rounds a monetary amount to whole cents. Percentage-based tax and
// discount math (e.g. 12.50 * 8.25%) otherwise leaves sub-cent fractions that
// flow into GrandTotal and get stored/charged inconsistently.
func roundCents(v float64) float64 {
	return math.Round(v*100) / 100
}

func NewService(db *mongo.Database) *Service {
	return &Service{
		collection: db.Collection("quotes"),
	}
}

// isEmptyValue reports a value that should be removed from the document rather
// than stored as a zero. Keeps quotes free of keys that carry no information.
func isEmptyValue(v interface{}) bool {
	switch t := v.(type) {
	case string:
		return t == ""
	case float64:
		return t == 0
	case int:
		return t == 0
	case bool:
		return !t
	case []ApprovalStep:
		return len(t) == 0
	case *time.Time:
		return t == nil
	}
	return v == nil
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
			"shippingRate":                quote.ShippingRate,
			"taxAmount":                   quote.TaxAmount,
			"taxRate":                     quote.TaxRate,
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
			"promoCode":                   quote.PromoCode,
			"promoDiscount":               quote.PromoDiscount,
			// Assigned by handleCreateQuoteRequest but absent from this map until
			// now, so it silently never persisted on any quote. This is the exact
			// trap the approval fields below are written out longhand to avoid.
			"leadTime": quote.LeadTime,

			"customerEmail": quote.CustomerEmail,
		},
		"$setOnInsert": bson.M{
			"_id":       primitive.NewObjectID(),
			"createdAt": time.Now(),
		},
	}

	// Approval fields are written when they carry a value and REMOVED when they do
	// not, rather than stored as zeroes. Both halves matter: a standard quote is
	// upserted in place, so a field merely left out of $set would survive from the
	// previous submission — a stale approvalStage would read as already signed
	// off — while writing zeroes would leave empty keys on every ordinary order.
	set := update["$set"].(bson.M)
	unset := bson.M{}
	// Stage 0 IS information once a chain exists — it means "awaiting level 1" —
	// so it is written rather than dropped. Omitting it left the document without
	// the field, and the conditional update that guards concurrent approvals
	// filters on it, so the first uncontended approval failed its own check.
	alwaysKeep := map[string]bool{}
	if len(quote.ApprovalChain) > 0 {
		alwaysKeep["approvalStage"] = true
	}
	for field, value := range map[string]interface{}{
		"approvalScope":             quote.ApprovalScope,
		"approvalThreshold":         quote.ApprovalThreshold,
		"approvalQuantityThreshold": quote.ApprovalQuantityThreshold,
		"approvalValidityHours":     quote.ApprovalValidityHours,
		"approvalStage":             quote.ApprovalStage,
		"approvalRequired":          quote.ApprovalRequired,
		"approvalChain":             quote.ApprovalChain,
		"approvalExpiresAt":         quote.ApprovalExpiresAt,
	} {
		if isEmptyValue(value) && !alwaysKeep[field] {
			unset[field] = ""
		} else {
			set[field] = value
		}
	}
	if len(unset) > 0 {
		update["$unset"] = unset
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
	// Quotes this account owns, plus the ones it actually needs to see as an
	// approver. Deliberately NOT "every quote I was ever named on": that granted
	// standing read access to colleagues' items, prices and addresses on orders
	// long since placed or rejected. An approver sees a quote while it is waiting
	// on the chain, and afterwards only if they personally decided a step.
	filter := bson.M{"$or": []bson.M{
		{"accountId": accountID},
		{"status": StatusPendingApproval, "approvalChain.approvers.accountId": accountID},
		{"approvalChain.decidedBy.accountId": accountID},
	}}
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

// applyApprovedPricing settles a negotiation into final numbers: each proposed
// price becomes the real price, and the totals are recomputed from them.
//
// Extracted verbatim from UpdateQuoteStatus so the approve-into-approval
// transition can apply the same settlement in a SINGLE write. Doing it as two
// writes left the quote briefly sitting at "approved" — payable, with the
// buyer's approval chain not yet started.
func applyApprovedPricing(q *Quote) {
	for i, item := range q.Items {
		if item.ProposedPrice > 0 {
			q.Items[i].Price = item.ProposedPrice
			q.Items[i].ProposedPrice = 0
		}
	}
	var subtotal float64
	for _, item := range q.Items {
		subtotal += item.Price * float64(item.Quantity)
	}
	// HEURISTIC, not a stored fact. A rate with a zero amount is the SHAPE left by
	// a tax-exempt buyer: quotes created before the exemption fix kept the company
	// rate and merely zeroed the amount, and recomputing from that rate would
	// resurrect tax the merchant deliberately did not charge — an inflated total
	// that is both what gets charged and what the approval gate is judged on.
	// It infers intent, and a small taxable order whose tax rounds to zero matches
	// the same shape; harmless there, since the tax was zero either way. Quotes
	// created from now on store rate 0 when exempt, so this only has to cover
	// existing rows. An explicit TaxExempt field would remove the inference.
	wasExempt := q.TaxRate > 0 && q.TaxAmount == 0 && q.Subtotal > 0
	q.Subtotal = subtotal
	if wasExempt {
		q.TaxRate = 0
		q.TaxAmount = 0
	} else if q.TaxRate > 0 {
		q.TaxAmount = roundCents(q.Subtotal * (q.TaxRate / 100))
	}
	// PromoDiscount is subtracted here for the same reason the create-time
	// calculation subtracts it: the gate is now judged on this number, and a
	// total inflated by an unapplied promo would both mis-fire the threshold and
	// be persisted as the amount charged.
	q.GrandTotal = roundCents(q.Subtotal - q.DiscountAmount - q.PromoDiscount + q.ShippingCost + q.TaxAmount)
	if q.GrandTotal < 0 {
		q.GrandTotal = 0
	}
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
		applyApprovedPricing(quote)
	}

	filter := bson.M{"_id": quoteID}
	update := bson.M{"$set": quote}
	_, err = s.collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return nil, err
	}

	return quote, nil
}

// stageMatcher matches the approval stage in a conditional update.
//
// Stage 0 needs the $exists arm: the quote document only carries approvalStage
// when it is non-zero (empty values are removed rather than stored as noise), and
// in MongoDB {field: 0} does NOT match a document where the field is absent.
// Without this the very first, entirely uncontended approval failed its own
// concurrency check and was rejected as a conflict.
func stageMatcher(stage int) interface{} {
	if stage != 0 {
		return stage
	}
	return bson.M{"$in": []interface{}{0, nil}}
}

// ErrApprovalConflict signals that the chain moved between the read and the
// write, so the caller's decision was not applied.
var ErrApprovalConflict = errors.New("approval conflict: this quote was decided concurrently, please refresh and retry")

// RecordApprovalDecision applies one approver's approve/reject to the step that
// is currently awaiting a decision.
//
// Any approver listed on the current step may clear it, which is what keeps an
// order moving when one of them is on leave. Approving advances the stage;
// the quote only becomes "approved" once the final step clears. Rejecting
// freezes the chain immediately.
//
// Concurrency: two approvers on the same step can click at the same moment. The
// write is conditional on the stage and status we read, mirroring the
// optimistic-concurrency guard used for refunds in order/service.go, so the
// loser gets ErrApprovalConflict instead of double-advancing the chain.
func (s *Service) RecordApprovalDecision(quoteID primitive.ObjectID, approver Approver, approve bool, note string) (*Quote, error) {
	current, err := s.GetQuote(quoteID)
	if err != nil {
		return nil, err
	}
	if current.Status != StatusPendingApproval {
		return nil, fmt.Errorf("quote is not awaiting approval (status %q)", current.Status)
	}
	if current.ApprovalExpired(time.Now()) {
		return nil, errors.New("this approval request has expired; the buyer must resubmit the order")
	}
	step := current.CurrentStep()
	if step == nil {
		return nil, errors.New("quote has no approval step awaiting a decision")
	}
	if !current.IsApprover(approver.AccountID) {
		return nil, errors.New("you are not an approver for this step")
	}

	observedStage := current.ApprovalStage
	now := time.Now()

	decided := *step
	decided.DecidedBy = &approver
	decided.DecidedAt = &now
	decided.Note = note

	if approve {
		decided.Status = ApprovalStepApproved
	} else {
		decided.Status = ApprovalStepRejected
	}
	newStage, newStatus := current.NextApprovalState(approve)

	// The permanent record, pushed in the SAME update as the decision. A separate
	// write would leave a window where a decision is committed with no record of
	// who made it, which is the exact failure this log exists to prevent.
	logEntry := NewApprovalDecision(current, *step, observedStage, decided.Status, &approver, note, now)

	set := bson.M{
		fmt.Sprintf("approvalChain.%d", observedStage): decided,
		"approvalStage": newStage,
		"status":        newStatus,
	}
	unset := bson.M{}
	if newStatus == "approved" {
		// The window bounds how long a REQUEST may sit unanswered, not how long a
		// settled order stays payable. Leaving it set made a fully-approved
		// negotiable quote permanently unpayable once it lapsed, with no way back:
		// unlike a standard quote the buyer cannot re-submit one from the cart.
		unset["approvalExpiresAt"] = ""
	}

	// Only apply if nobody else has decided this step in the meantime.
	filter := bson.M{
		"_id":           quoteID,
		"approvalStage": stageMatcher(observedStage),
		"status":        StatusPendingApproval,
	}
	update := bson.M{
		"$set": set,
		"$push": bson.M{
			"history":           QuoteHistory{Status: newStatus, ChangedAt: now},
			"approvalDecisions": logEntry,
		},
	}
	if len(unset) > 0 {
		update["$unset"] = unset
	}
	result, err := s.collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return nil, err
	}
	if result.MatchedCount == 0 {
		return nil, ErrApprovalConflict
	}

	return s.GetQuote(quoteID)
}

// ApproveIntoApproval settles the seller's approval AND hands the quote to the
// buyer's approval chain in ONE write.
//
// The single write is the point. Doing it as "set approved" followed by "set
// pending_approval" left a window where the quote was committed as approved and
// therefore payable, with the chain not yet started — a buyer polling at that
// instant could pay an order no approver ever saw. It also needed a snapshot and
// a rollback for the case where the second write failed, and that rollback was
// itself a source of fail-open bugs. One conditional write removes all of it.
//
// The update is conditional on the status we read, so a concurrent transition
// (a double-clicked Approve, say) loses rather than double-applying.
func (s *Service) ApproveIntoApproval(quoteID primitive.ObjectID, expectedStatus string, chain []ApprovalStep, validityHours float64) (*Quote, error) {
	current, err := s.GetQuote(quoteID)
	if err != nil {
		return nil, err
	}
	if len(chain) == 0 {
		return nil, errors.New("quote has no approval chain configured")
	}

	// Settle the negotiated prices exactly as an ordinary approval would, so the
	// approvers review the final numbers rather than proposed ones.
	applyApprovedPricing(current)

	now := time.Now()
	// A fresh window, stamped only now: a negotiable quote can be haggled over
	// for days, and starting the clock at creation would routinely hand the
	// approvers an already-expired request.
	//
	// The window can come from either side's policy. The chain the caller built
	// may contain steps the SELLER owns, whose validity setting is on the seller's
	// account and never denormalised onto the quote — so the caller passes it in,
	// and only falls back to the quote's own (buyer-side) value.
	if validityHours > 0 {
		current.ApprovalValidityHours = validityHours
	}
	expires := now.Add(current.ApprovalWindow())

	res, err := s.collection.UpdateOne(context.Background(),
		bson.M{"_id": quoteID, "status": expectedStatus},
		bson.M{
			"$set": bson.M{
				"status":                StatusPendingApproval,
				"approvalRequired":      true,
				"approvalStage":         0,
				"approvalChain":         chain,
				"approvalExpiresAt":     expires,
				"approvalValidityHours": current.ApprovalValidityHours,
				"items":                 current.Items,
				"subtotal":              current.Subtotal,
				// taxRate travels with taxAmount. applyApprovedPricing can zero the
				// rate for a legacy tax-exempt quote, and omitting it here left the
				// document self-contradictory (rate 8.25 beside amount 0), which then
				// flowed into the order snapshot and the buyer's copy. The non-gated
				// path writes the whole document and always persisted it, so the two
				// approval routes were leaving the same quote in different states.
				"taxRate":    current.TaxRate,
				"taxAmount":  current.TaxAmount,
				"grandTotal": current.GrandTotal,
			},
			// BOTH entries. Collapsing the two writes into one must not collapse
			// the audit trail with them: the seller genuinely did approve, and
			// dropping that record leaves the very gap this feature is meant to
			// close for buyers reconstructing who authorised what.
			"$push": bson.M{"history": bson.M{"$each": []QuoteHistory{
				{Status: "approved", ChangedAt: now},
				{Status: StatusPendingApproval, ChangedAt: now},
			}}},
		})
	if err != nil {
		return nil, err
	}
	if res.MatchedCount == 0 {
		return nil, ErrApprovalConflict
	}
	return s.GetQuote(quoteID)
}

// HoldForApproval puts an already-settled quote in front of the buyer's approval
// chain, without touching its money.
//
// Needed because a quote drafted by a sales rep carries no buyer policy: the
// seller's token has no configurations claim, and this service must not accept a
// policy from the request body (it could name any account, and verifying
// membership would mean calling account-service). The buyer's own token is
// present when they place the order, so that is the first and only point their
// policy can be applied to such a quote.
//
// Deliberately separate from ApproveIntoApproval: there is nothing to settle
// here, and recomputing money on the payment path is exactly the risk not worth
// taking. Conditional on the status read so a double submit cannot re-hold.
func (s *Service) HoldForApproval(quoteID primitive.ObjectID, chain []ApprovalStep, startStage int, validityHours float64, expectedStatus, buyerEmail string) (*Quote, error) {
	if len(chain) == 0 {
		return nil, errors.New("cannot hold a quote without an approval chain")
	}
	if startStage < 0 || startStage >= len(chain) {
		return nil, errors.New("approval chain has no step left to decide")
	}
	hours := validityHours
	if hours <= 0 {
		hours = DefaultApprovalValidityHours
	}
	now := time.Now()
	expires := now.Add(time.Duration(hours * float64(time.Hour)))

	set := bson.M{
		"status":                StatusPendingApproval,
		"approvalRequired":      true,
		"approvalStage":         startStage,
		"approvalChain":         chain,
		"approvalExpiresAt":     expires,
		"approvalValidityHours": hours,
	}
	// The address the approval OUTCOME goes to. Both other gates refuse to hold a
	// quote that carries no buyer email, because that email is the buyer's only
	// signal that their order became payable. This path had neither the check nor
	// a backfill, so a rep-drafted quote created without one was held here and the
	// buyer was left to poll the quote page. The buyer IS the caller here, so
	// their address is already to hand.
	if buyerEmail != "" {
		set["customerEmail"] = buyerEmail
	}

	res, err := s.collection.UpdateOne(context.Background(),
		bson.M{"_id": quoteID, "status": expectedStatus},
		bson.M{
			"$set":  set,
			"$push": bson.M{"history": QuoteHistory{Status: StatusPendingApproval, ChangedAt: now}},
		})
	if err != nil {
		return nil, err
	}
	if res.MatchedCount == 0 {
		return nil, ErrApprovalConflict
	}
	return s.GetQuote(quoteID)
}

// ForceRelease overrides an outstanding buyer approval, for the case where an
// approver is unreachable and the seller decides to let the order through.
//
// Conditional on the quote still awaiting approval, so a duplicate request
// cannot "release" a quote that was never gated. The window is cleared because a
// stalled approval has usually lapsed too, and handlePlaceOrderRequest refuses an
// expired quote — without this the release would succeed and the buyer still
// could not pay.
func (s *Service) ForceRelease(quoteID primitive.ObjectID, releasedBy *Approver) (*Quote, error) {
	current, err := s.GetQuote(quoteID)
	if err != nil {
		return nil, err
	}
	// Mark the outstanding levels as released rather than leaving them "pending".
	// A released order is approved and payable, and a chain still reading
	// "Level 1 — Pending" on it tells the buyer the opposite of what happened.
	now := time.Now()
	chain := append([]ApprovalStep(nil), current.ApprovalChain...)
	// Every level the override actually skipped gets its own entry. Recording only
	// the quote-level fact would leave the log saying an order became payable with
	// no indication of which sign-offs were bypassed to get there, which is the
	// single most important thing to be able to reconstruct later.
	var released []interface{}
	for i := range chain {
		if chain[i].Status == ApprovalStepPending {
			chain[i].Status = ApprovalStepReleased
			released = append(released, NewApprovalDecision(
				current, chain[i], i, ApprovalStepReleased, releasedBy, "", now))
		}
	}

	push := bson.M{"history": QuoteHistory{Status: "approved", ChangedAt: now}}
	// Only when there is something to record. MongoDB rejects `$each: null`, so an
	// empty slice here would turn a release with nothing left pending from a
	// harmless no-op into a hard failure on the seller's escape hatch.
	if len(released) > 0 {
		push["approvalDecisions"] = bson.M{"$each": released}
	}

	res, err := s.collection.UpdateOne(context.Background(),
		// approvalStage is part of the filter because the chain below is a
		// read-modify-write: without it, an approver deciding at the same instant
		// advances the stage and this write silently replaces their recorded
		// decision with "released".
		bson.M{"_id": quoteID, "status": StatusPendingApproval, "approvalStage": stageMatcher(current.ApprovalStage)},
		bson.M{
			"$set":   bson.M{"status": "approved", "approvalChain": chain},
			"$unset": bson.M{"approvalExpiresAt": ""},
			"$push":  push,
		})
	if err != nil {
		return nil, err
	}
	if res.MatchedCount == 0 {
		return nil, errors.New("this quote is no longer awaiting approval at the step that was read; refresh and retry")
	}
	return s.GetQuote(quoteID)
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
	discountAmount := roundCents(quote.Subtotal * (discountPercentage / 100))

	// Apply discount and recalculate totals
	quote.DiscountPercentage = discountPercentage
	quote.DiscountAmount = discountAmount
	quote.GrandTotal = roundCents(quote.Subtotal - discountAmount + quote.ShippingCost + quote.TaxAmount)

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
	ItemID   string   `json:"itemId"`
	Quantity *int     `json:"quantity,omitempty"`
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
				if itemUpdate.Quantity != nil && *itemUpdate.Quantity > 0 {
					quote.Items[i].Quantity = *itemUpdate.Quantity
				}
				if itemUpdate.Price != nil && *itemUpdate.Price > 0 {
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
	quote.DiscountAmount = roundCents(quote.Subtotal * (quote.DiscountPercentage / 100))
	if quote.TaxRate > 0 {
		quote.TaxAmount = roundCents(quote.Subtotal * (quote.TaxRate / 100))
	}
	quote.GrandTotal = roundCents(quote.Subtotal - quote.DiscountAmount + quote.ShippingCost + quote.TaxAmount)

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

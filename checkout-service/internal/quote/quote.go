package quote

import (
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Coords represents geographic coordinates.
type Coords struct {
	Lat float64 `bson:"lat" json:"lat"`
	Lng float64 `bson:"lng" json:"lng"`
}

// Address represents a physical address.
type Address struct {
	Street string `bson:"street" json:"street"`
	City   string `bson:"city" json:"city"`
	State  string `bson:"state" json:"state"`
	Zip    string `bson:"zip" json:"zip"`
	Coords Coords `bson:"coordinates" json:"coordinates"`
}

// CompanyLocation represents a company's physical location.
type CompanyLocation struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CompanyID    primitive.ObjectID `bson:"companyId" json:"companyId"`
	LocationName string             `bson:"locationName" json:"locationName"`
	Address      Address            `bson:"address" json:"address"`
}

// CustomerAddress represents a customer's address.
type CustomerAddress struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CustomerID        primitive.ObjectID `bson:"customerId" json:"customerId"`
	RecipientName     string             `bson:"recipientName" json:"recipientName"`
	Address           Address            `bson:"address" json:"address"`
	PhoneNumber       *string            `bson:"phoneNumber,omitempty" json:"phoneNumber,omitempty"`
	AddressLabel      *string            `bson:"addressLabel,omitempty" json:"addressLabel,omitempty"`
	IsDefaultShipping bool               `bson:"isDefaultShipping" json:"isDefaultShipping"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// QuoteHistory represents a single entry in the quote's history.
type QuoteHistory struct {
	Status    string    `bson:"status" json:"status"`
	ChangedAt time.Time `bson:"changedAt" json:"changedAt"`
}

// Comment represents a single comment in the quote's negotiation history.
type Comment struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	AccountID string             `bson:"accountId" json:"accountId"`
	Text      string             `bson:"text" json:"text"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}

// Quote represents a price quote for a cart.
type Quote struct {
	ID                          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	CartID                      primitive.ObjectID `bson:"cartId" json:"cartId"`
	AccountID                   string             `bson:"accountId" json:"accountId"`
	SellerID                    string             `bson:"sellerId" json:"sellerId"`
	Items                       []cart.CartItem    `bson:"items" json:"items"`
	Subtotal                    float64            `bson:"subtotal" json:"subtotal"`
	ShippingCost                float64            `bson:"shippingCost" json:"shippingCost"`
	ShippingRate                float64            `bson:"shippingRate,omitempty" json:"shippingRate,omitempty"`
	TaxAmount                   float64            `bson:"taxAmount" json:"taxAmount"`
	TaxRate                     float64            `bson:"taxRate,omitempty" json:"taxRate,omitempty"`
	GrandTotal                  float64            `bson:"grandTotal" json:"grandTotal"`
	AvailablePaymentMethods     []string           `bson:"availablePaymentMethods" json:"availablePaymentMethods"`
	AvailableDeliveryMethods    []string           `bson:"availableDeliveryMethods" json:"availableDeliveryMethods"`
	AvailableShippingOutOptions []string           `bson:"availableShippingOutOptions" json:"availableShippingOutOptions"`
	CompanyLocations            []CompanyLocation  `bson:"companyLocations,omitempty" json:"companyLocations,omitempty"`
	CustomerAddresses           []CustomerAddress  `bson:"customerAddresses,omitempty" json:"customerAddresses,omitempty"`
	CreatedAt                   time.Time          `bson:"createdAt" json:"createdAt"`
	ExpiresAt                   time.Time          `bson:"expiresAt" json:"expiresAt"`
	QuoteType                   string             `bson:"quoteType" json:"quoteType"` // "standard" or "negotiable"
	Status                      string             `bson:"status" json:"status"`       // "draft", "open", "pending_approval", "approved", "rejected", "ordered"
	History                     []QuoteHistory     `bson:"history,omitempty" json:"history,omitempty"`
	Comments                    []Comment          `bson:"comments,omitempty" json:"comments,omitempty"` // New field
	DiscountPercentage          float64            `bson:"discountPercentage,omitempty" json:"discountPercentage,omitempty"`
	DiscountAmount              float64            `bson:"discountAmount,omitempty" json:"discountAmount,omitempty"`
	Notes                       string             `bson:"notes,omitempty" json:"notes,omitempty"`
	LeadTime                    float64            `bson:"leadTime,omitempty" json:"leadTime,omitempty"`
	PromoCode                   string             `bson:"promoCode,omitempty" json:"promoCode,omitempty"`
	PromoDiscount               float64            `bson:"promoDiscount,omitempty" json:"promoDiscount,omitempty"`

	// Buyer-side order approval (Roadmap #21). The policy is denormalised onto the
	// quote at create time so the seller-approve step can gate a negotiable quote
	// later without the buyer's JWT, and so approval emails can be addressed
	// without ever calling account-service.
	//
	// EVERY field here must also appear in the $set map in CreateQuote. That map
	// is an explicit field list, so anything omitted is silently NOT written and,
	// worse, survives from a previous submission of the same standard quote. The
	// LeadTime field above is the live proof of that trap: it is assigned by the
	// handler, absent from the $set map, and therefore never persists.
	ApprovalScope             string         `bson:"approvalScope,omitempty" json:"approvalScope,omitempty"`
	ApprovalThreshold         float64        `bson:"approvalThreshold,omitempty" json:"approvalThreshold,omitempty"`
	ApprovalQuantityThreshold float64        `bson:"approvalQuantityThreshold,omitempty" json:"approvalQuantityThreshold,omitempty"`
	ApprovalExpiresAt         *time.Time     `bson:"approvalExpiresAt,omitempty" json:"approvalExpiresAt,omitempty"`
	ApprovalStage             int            `bson:"approvalStage,omitempty" json:"approvalStage,omitempty"`
	ApprovalChain             []ApprovalStep `bson:"approvalChain,omitempty" json:"approvalChain,omitempty"`
	// Whether the gate actually FIRED for this quote, as opposed to a policy
	// merely being attached. The chain is denormalised onto every eligible
	// quote so a negotiable one can be gated later, which means chain presence
	// alone says nothing about whether approval was required — an under-threshold
	// order would otherwise render a bogus "Level 1 pending" card and show up in
	// Quote History alongside real approvals.
	ApprovalRequired bool `bson:"approvalRequired,omitempty" json:"approvalRequired,omitempty"`
	// Carried so SendForApproval can stamp a FRESH window when a negotiable
	// quote finally reaches its approvers. Stamping at create time would start
	// the clock during the negotiation, and any negotiation longer than the
	// window would produce an order nobody could ever approve.
	ApprovalValidityHours float64 `bson:"approvalValidityHours,omitempty" json:"approvalValidityHours,omitempty"`
	// The buyer's address, denormalised at create time so an approve/reject can
	// notify the person WAITING on the decision. The PATCH caller is the
	// approver, so their address is the wrong target for that email.
	CustomerEmail string `bson:"customerEmail,omitempty" json:"customerEmail,omitempty"`

	// Append-only record of every approval decision ever made on this quote
	// (Roadmap #21f). DELIBERATELY EXCLUDED from the $set map in CreateQuote,
	// which is the opposite of the rule stated for the fields above.
	//
	// Those fields must be listed there because a standard quote is upserted in
	// place and stale state would survive. Here surviving is the entire point: a
	// buyer who edits their cart and re-submits gets a fresh chain, and the record
	// of what was approved before that edit has to outlive it. Each entry carries
	// its own total, so an earlier decision cannot be mistaken for one about the
	// current order.
	ApprovalDecisions []ApprovalDecision `bson:"approvalDecisions,omitempty" json:"approvalDecisions,omitempty"`
}

// DefaultApprovalValidityHours bounds how long a pending approval may sit before
// its price snapshot is treated as stale.
const DefaultApprovalValidityHours = 72

// ApprovalWindow returns the configured validity window, falling back to the
// default when unset or nonsensical.
func (q *Quote) ApprovalWindow() time.Duration {
	hours := q.ApprovalValidityHours
	if hours <= 0 {
		hours = DefaultApprovalValidityHours
	}
	return time.Duration(hours * float64(time.Hour))
}

// Approval step statuses.
const (
	ApprovalStepPending  = "pending"
	ApprovalStepApproved = "approved"
	ApprovalStepRejected = "rejected"
	// Set on levels that never got to decide because the seller overrode the
	// chain. Distinct from "approved": nobody at the buyer actually signed off.
	ApprovalStepReleased = "released"
)

// Approval scope values, mirroring the quoteType vocabulary so a scope can be
// compared directly against a quote's type. Declared here rather than imported
// from account-service: the services stay independent, and this is a wire
// vocabulary both sides agree on, like the status strings above.
const (
	ApprovalScopeNone       = "none"
	ApprovalScopeStandard   = "standard"
	ApprovalScopeNegotiable = "negotiable"
	ApprovalScopeBoth       = "both"
)

// StatusPendingApproval is the quote status while buyer-side sign-off is
// outstanding. handlePlaceOrderRequest already refuses anything that is not
// "approved", so this status blocks payment with no change to the money path.
const StatusPendingApproval = "pending_approval"

// ApprovalStep is one tier of a quote's approval chain. Several approvers may sit
// on a step and ANY ONE of them clears it, which is what keeps an order moving
// when someone is on leave without needing a scheduler to escalate.
type ApprovalStep struct {
	Name string `bson:"name,omitempty" json:"name,omitempty"`
	// Which organisation this step belongs to (Roadmap #21d): ApprovalSideSeller
	// for the selling org's internal sign-off, ApprovalSideBuyer for the buying
	// org's. Empty means buyer, which is what every quote written before #21d
	// carries and what the buyer-only path still writes.
	//
	// The two sides share ONE ordered chain rather than living in separate fields.
	// A second chain would need a second stage counter, a second set of
	// predicates and a second race window; a tag on the step costs one string and
	// leaves CurrentStep, IsApprover and NextApprovalState exactly as they were.
	Side      string     `bson:"side,omitempty" json:"side,omitempty"`
	Approvers []Approver `bson:"approvers,omitempty" json:"approvers,omitempty"`
	Status    string     `bson:"status,omitempty" json:"status,omitempty"`
	DecidedBy *Approver  `bson:"decidedBy,omitempty" json:"decidedBy,omitempty"`
	DecidedAt *time.Time `bson:"decidedAt,omitempty" json:"decidedAt,omitempty"`
	Note      string     `bson:"note,omitempty" json:"note,omitempty"`
}

// ApprovalDecision is one decision, recorded once and never rewritten.
//
// The CHAIN is live state: it is rebuilt whenever the gate re-fires, and
// buildApprovalChain deliberately strips decision fields so a rebuilt chain can
// never carry a previous run's approvals. That is right for a re-submitted cart,
// where old sign-offs must not survive a changed order. It was also erasing the
// record: a seller who withdrew a part-approved quote and reinstated it wiped who
// had approved which level, and their note with it (Roadmap #21f).
//
// So the record lives OUTSIDE the chain. Nothing ever removes an entry, and the
// two writes that create one do it in the same update as the decision itself, so
// a decision can never be committed without its record.
//
// GrandTotal is carried per entry because a quote's money changes between runs.
// "Jane approved level 1" is misleading on its own once the cart has been
// re-submitted at a different total; "Jane approved level 1 at $4,200" is not.
type ApprovalDecision struct {
	Side     string    `bson:"side,omitempty" json:"side,omitempty"`
	Level    int       `bson:"level" json:"level"`
	StepName string    `bson:"stepName,omitempty" json:"stepName,omitempty"`
	Decision string    `bson:"decision" json:"decision"`
	By       *Approver `bson:"by,omitempty" json:"by,omitempty"`
	At       time.Time `bson:"at" json:"at"`
	Note     string    `bson:"note,omitempty" json:"note,omitempty"`
	// What the buyer would have owed when this decision was made.
	GrandTotal float64 `bson:"grandTotal,omitempty" json:"grandTotal,omitempty"`
}

// Approval sides. A step is cleared by an account on the side that owns it, so
// the tag is what decides which role may act on the step currently in front.
const (
	ApprovalSideSeller = "seller"
	ApprovalSideBuyer  = "buyer"
)

// SideOf returns the side a step belongs to, treating the empty tag as buyer.
// Quotes written before #21d carry no tag and are buyer-side by definition.
func (s ApprovalStep) SideOf() string {
	if s.Side == ApprovalSideSeller {
		return ApprovalSideSeller
	}
	return ApprovalSideBuyer
}

// Approver is a customer account that may sign off. Email and name are carried so
// checkout-service can address approval mail from its own copy.
type Approver struct {
	AccountID string `bson:"accountId" json:"accountId"`
	Email     string `bson:"email,omitempty" json:"email,omitempty"`
	Name      string `bson:"name,omitempty" json:"name,omitempty"`
}

// HasApprovalSide reports whether the chain contains a step owned by a side.
func (q *Quote) HasApprovalSide(side string) bool {
	for _, step := range q.ApprovalChain {
		if step.SideOf() == side {
			return true
		}
	}
	return false
}

// RedactedFor returns the quote as one side of the trade is entitled to see it.
//
// A chain now carries BOTH organisations' levels (Roadmap #21d), and the whole
// quote is marshalled to whoever passes authorisation — so without this a buyer
// receives the seller's internal approvers by name and address along with their
// decision notes ("margin too thin at this price"), and the seller receives the
// buyer's ("check with finance before we commit"). Neither is anyone's business
// but their own, and notes are written in the expectation that they are internal.
//
// The other side's levels are not hidden, only reduced to their existence and
// status. That is what a rep needs to tell a customer their order is waiting on
// the customer's own people, and what a buyer needs to see that their supplier is
// still signing off — without a single name, address or note crossing over.
//
// Returns a copy; the stored quote is untouched.
func (q *Quote) RedactedFor(side string) *Quote {
	if q == nil || (len(q.ApprovalChain) == 0 && len(q.ApprovalDecisions) == 0) {
		return q
	}
	c := *q

	c.ApprovalChain = make([]ApprovalStep, 0, len(q.ApprovalChain))
	for _, step := range q.ApprovalChain {
		if step.SideOf() == side {
			c.ApprovalChain = append(c.ApprovalChain, step)
			continue
		}
		c.ApprovalChain = append(c.ApprovalChain, ApprovalStep{
			Side:   step.Side,
			Status: step.Status,
		})
	}

	// The decision LOG gets the same treatment as the chain, and for the same
	// reason. It holds precisely what must not cross the trade: who signed off
	// inside an organisation and what they wrote while doing it. Skipping it here
	// would have reopened the whole disclosure through a second field.
	//
	// The entry itself is kept so each side can still see that the other's level
	// was decided and when, which is what a rep needs to answer "where is my
	// order". Identity and note are dropped.
	if len(q.ApprovalDecisions) > 0 {
		c.ApprovalDecisions = make([]ApprovalDecision, 0, len(q.ApprovalDecisions))
		for _, d := range q.ApprovalDecisions {
			if d.SideOf() == side {
				c.ApprovalDecisions = append(c.ApprovalDecisions, d)
				continue
			}
			// An OVERRIDE keeps its author for everyone. A release is the one
			// decision that crosses the boundary: it is always made by the seller,
			// and it can be made against the BUYER's level, so tagging it with the
			// level's side would have hidden the seller's own person from their own
			// organisation and hidden from the buyer who overruled their control.
			// An approve or reject is internal to one organisation; an override
			// acts on the other party and must not be anonymous to them.
			if d.Decision != ApprovalStepReleased {
				d.By = nil
			}
			d.Note = ""
			d.StepName = ""
			c.ApprovalDecisions = append(c.ApprovalDecisions, d)
		}
	}
	return &c
}

// SideOf returns the side a decision belongs to, treating an empty tag as buyer,
// exactly as a step does.
func (d ApprovalDecision) SideOf() string {
	if d.Side == ApprovalSideSeller {
		return ApprovalSideSeller
	}
	return ApprovalSideBuyer
}

// NewApprovalDecision builds a log entry from the step being decided.
//
// One constructor so the two writers cannot drift: a decision recorded with a
// different level base, or without its total, is worse than none because it
// looks authoritative.
func NewApprovalDecision(q *Quote, step ApprovalStep, stage int, decision string, by *Approver, note string, at time.Time) ApprovalDecision {
	return ApprovalDecision{
		Side:     step.SideOf(),
		Level:    stage + 1, // 1-based, matching what the portal shows
		StepName: step.Name,
		Decision: decision,
		By:       by,
		At:       at,
		Note:     note,
		// The money as it stands at the moment of the decision, so the entry
		// still means something after the quote is re-priced or re-submitted.
		GrandTotal: q.GrandTotal,
	}
}

// StepsForSide returns just the steps one organisation owns.
//
// A chain can hold both sides at once, so rebuilding either half must start from
// that half. Rebuilding from the whole chain re-tagged the other side's steps as
// its own, which put approvers on levels their role can never clear.
func (q *Quote) StepsForSide(side string) []ApprovalStep {
	var out []ApprovalStep
	for _, step := range q.ApprovalChain {
		if step.SideOf() == side {
			out = append(out, step)
		}
	}
	return out
}

// ResolvedSteps returns the steps that already carry a decision.
//
// Used when a chain is rebuilt underneath a quote that has already been part-way
// through one — a rep-drafted order that cleared the seller's own levels and then
// meets the buyer's policy at payment. Replacing the whole chain there would
// erase who signed off at the seller, which is the record the whole feature
// exists to keep. Pending steps are deliberately dropped: an unresolved level
// from a superseded chain has no claim on the new one.
func (q *Quote) ResolvedSteps() []ApprovalStep {
	var out []ApprovalStep
	for _, step := range q.ApprovalChain {
		if step.Status != "" && step.Status != ApprovalStepPending {
			out = append(out, step)
		}
	}
	return out
}

// CurrentStep returns the step awaiting a decision, or nil when the chain is
// empty or already fully resolved.
func (q *Quote) CurrentStep() *ApprovalStep {
	if q.ApprovalStage < 0 || q.ApprovalStage >= len(q.ApprovalChain) {
		return nil
	}
	return &q.ApprovalChain[q.ApprovalStage]
}

// IsApprover reports whether accountID may decide the step currently awaiting a
// decision. Any approver listed on that step qualifies.
func (q *Quote) IsApprover(accountID string) bool {
	step := q.CurrentStep()
	if step == nil || accountID == "" {
		return false
	}
	for _, a := range step.Approvers {
		if a.AccountID == accountID {
			return true
		}
	}
	return false
}

// CanBeReadByApprover reports whether a non-owner may read this quote because of
// their part in its approval.
//
// Scoped deliberately: while the quote is awaiting the chain, anyone named on it
// needs to see it (including later tiers, who must be able to look ahead).
// Afterwards, only someone who actually cast a decision keeps access. Being
// listed once must not grant permanent sight of a colleague's items, prices and
// delivery addresses on every order that followed.
func (q *Quote) CanBeReadByApprover(accountID string) bool {
	if accountID == "" {
		return false
	}
	for _, step := range q.ApprovalChain {
		if step.DecidedBy != nil && step.DecidedBy.AccountID == accountID {
			return true
		}
	}
	if q.Status != StatusPendingApproval {
		return false
	}
	for _, step := range q.ApprovalChain {
		for _, a := range step.Approvers {
			if a.AccountID == accountID {
				return true
			}
		}
	}
	return false
}

// ApprovalExpired reports whether the approval window has passed. A quote is a
// price snapshot; without this an approver could sign off days later and the
// buyer would order at a stale price.
func (q *Quote) ApprovalExpired(now time.Time) bool {
	return q.ApprovalExpiresAt != nil && now.After(*q.ApprovalExpiresAt)
}

// ApprovalRejected reports whether a buyer's approver turned this order down.
//
// The quote status alone cannot answer this: a SELLER rejecting a negotiation
// and a BUYER's approver refusing an order both land on status "rejected". Only
// the chain distinguishes them, and the difference matters — a seller may
// revisit their own rejection, but must not be able to overturn the buyer's.
func (q *Quote) ApprovalRejected() bool {
	for _, step := range q.ApprovalChain {
		// BUYER-side only, as the name and the rule above say. Matching any side
		// dead-ended the quote permanently once #21d gave sellers their own levels:
		// a sales manager rejecting a margin froze the quote in "rejected", and
		// nothing could revive it. Force-release could not (it filters on
		// pending_approval), customerPropose could not (it excludes rejected), and
		// a rep re-pricing it via sellerUpdate could then never approve it again.
		// A buyer-created standard quote can be resubmitted from the cart; a
		// rep-drafted negotiable one has no such escape.
		if step.SideOf() == ApprovalSideBuyer && step.Status == ApprovalStepRejected {
			return true
		}
	}
	return false
}

// CanEnterApproval reports whether a seller approval from this state may start
// the buyer's chain.
//
// "rejected" is included deliberately. A seller who withdraws a quote and later
// reinstates it must be re-gated — otherwise reject-then-approve is a one-step
// bypass of the buyer's whole approval policy. A BUYER's rejection is a different
// thing and is refused earlier by ApprovalRejected, so including the status here
// cannot overturn their decision.
//
// "ordered" and "approved" stay out: re-running a chain over an order already
// paid for, or already through approval, is never meaningful.
func (q *Quote) CanEnterApproval() bool {
	switch q.Status {
	case "draft", "open", "proposed", "rejected":
		return true
	}
	return false
}

// OpenToBuyerChanges reports whether the BUYER may still propose prices.
//
// Deliberately its own list rather than reusing CanEnterApproval, which answers
// "may a seller approval start the chain from here" and includes "rejected" so a
// seller can withdraw and reinstate. Letting a buyer propose on a quote their own
// approver rejected would revive it to "proposed" while ApprovalRejected still
// blocks the seller from approving — a dead end the buyer created themselves.
// Two predicates that happen to share values today are one edit from diverging.
func (q *Quote) OpenToBuyerChanges() bool {
	switch q.Status {
	case "draft", "open", "proposed":
		return true
	}
	return false
}

// TotalQuantity sums the line quantities on the quote.
func (q *Quote) TotalQuantity() float64 {
	var total float64
	for _, item := range q.Items {
		total += float64(item.Quantity)
	}
	return total
}

// ShouldGate reports whether this quote's own policy requires buyer approval.
//
// SINGLE SOURCE OF TRUTH for that decision. It was previously computed
// independently at quote-creation and again at seller-approve, from inputs that
// drifted apart — different totals, different scope handling — and every
// divergence became a bug where the gate either failed to fire or fired when it
// should not have. Both callers now ask this one function, evaluated against the
// money on the quote it is called with, so a caller that needs the settled total
// must settle first (see SettledCopy).
func (q *Quote) ShouldGate(quoteType string) bool {
	if len(q.ApprovalChain) == 0 {
		return false
	}
	return PolicyGates(q.ApprovalScope, q.ApprovalThreshold, q.ApprovalQuantityThreshold,
		quoteType, q.GrandTotal, q.TotalQuantity())
}

// PolicyGates is the gate rule itself, independent of where the policy is stored.
//
// ShouldGate answers it for a policy denormalised onto the quote (the buyer's,
// copied at create time because the buyer's token is absent when the seller
// approves). The SELLING organisation's policy is never denormalised — it arrives
// on the approving account's own token, read fresh — so it has no quote fields to
// read and asks the rule directly. Same rule, two sources; splitting the rule
// instead is what produced the create-time/approve-time drift this consolidated.
//
// Chain emptiness is deliberately NOT checked here: it is a property of the
// policy, not of the threshold rule, and each caller knows its own chain.
func PolicyGates(scope string, threshold, qtyThreshold float64, quoteType string, total, quantity float64) bool {
	if scope == "" || scope == ApprovalScopeNone {
		return false
	}
	if scope != ApprovalScopeBoth && scope != quoteType {
		return false
	}
	return (threshold > 0 && total >= threshold) ||
		(qtyThreshold > 0 && quantity >= qtyThreshold)
}

// SettledCopy returns a copy of the quote with the negotiated prices applied,
// persisting nothing.
//
// The gate must be judged on what the buyer would actually owe. Testing the
// pre-settlement total let a quote negotiated UP past its threshold approve
// itself: the stored total was below the limit, the settled one above it.
func (q *Quote) SettledCopy() *Quote {
	c := *q
	c.Items = append([]cart.CartItem(nil), q.Items...)
	applyApprovedPricing(&c)
	return &c
}

// NextApprovalState computes the stage and quote status that result from a
// decision on the step currently awaiting one.
//
// Pure so the state machine is testable without a database: the surrounding
// RecordApprovalDecision is all Mongo plumbing, this is the actual rule. A
// rejection freezes the chain where it stands; an approval advances one step and
// only reaches "approved" once the final step clears.
func (q *Quote) NextApprovalState(approve bool) (stage int, status string) {
	if !approve {
		return q.ApprovalStage, "rejected"
	}
	next := q.ApprovalStage + 1
	if next >= len(q.ApprovalChain) {
		return next, "approved"
	}
	return next, StatusPendingApproval
}

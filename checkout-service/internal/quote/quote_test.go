package quote

import (
	"testing"
	"time"

	"github.com/syed/businesscart/checkout-service/internal/cart"
	"go.mongodb.org/mongo-driver/bson"
)

// Pure-function tests for the order-approval chain (Roadmap #21). No DB required:
// RecordApprovalDecision is Mongo plumbing around NextApprovalState, which holds
// the actual rule. The database path is covered end to end by backend-flow-test.py.

func chain(stepApprovers ...[]string) []ApprovalStep {
	steps := make([]ApprovalStep, 0, len(stepApprovers))
	for _, ids := range stepApprovers {
		approvers := make([]Approver, 0, len(ids))
		for _, id := range ids {
			approvers = append(approvers, Approver{AccountID: id, Email: id + "@test.com"})
		}
		steps = append(steps, ApprovalStep{Approvers: approvers, Status: ApprovalStepPending})
	}
	return steps
}

func TestQuote_IsApprover(t *testing.T) {
	q := Quote{ApprovalChain: chain([]string{"alice", "bob"}, []string{"carol"}), ApprovalStage: 0}

	cases := []struct {
		name      string
		accountID string
		stage     int
		want      bool
	}{
		// Several approvers per step, any one of whom can clear it: this is what
		// keeps an order moving when one of them is on leave.
		{"first approver on current step", "alice", 0, true},
		{"second approver on same step", "bob", 0, true},
		// A later-stage approver must NOT be able to jump the queue.
		{"approver from a future step", "carol", 0, false},
		{"approver from an earlier step once stage advances", "alice", 1, false},
		{"approver of the now-current step", "carol", 1, true},
		{"stranger", "mallory", 0, false},
		{"empty account id", "", 0, false},
		{"stage past the end of the chain", "carol", 2, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			q.ApprovalStage = tc.stage
			if got := q.IsApprover(tc.accountID); got != tc.want {
				t.Errorf("IsApprover(%q) at stage %d = %v, want %v", tc.accountID, tc.stage, got, tc.want)
			}
		})
	}
}

func TestQuote_CanBeReadByApprover(t *testing.T) {
	// Alice decided step 0; carol is still pending on step 1.
	q := Quote{
		ApprovalChain: chain([]string{"alice"}, []string{"carol"}),
		ApprovalStage: 1,
		Status:        StatusPendingApproval,
	}
	q.ApprovalChain[0].DecidedBy = &Approver{AccountID: "alice"}

	if !q.CanBeReadByApprover("alice") {
		t.Error("alice decided a step and must keep sight of what she approved")
	}
	if !q.CanBeReadByApprover("carol") {
		t.Error("carol is awaited on the current step and must be able to read it")
	}
	if q.CanBeReadByApprover("mallory") {
		t.Error("a stranger must never gain read access")
	}
	if q.CanBeReadByApprover("") {
		t.Error("empty account id must never match")
	}

	// Once the quote leaves the approval flow, only participants keep access —
	// being listed once must not grant permanent sight of a colleague's orders.
	q.Status = "ordered"
	if !q.CanBeReadByApprover("alice") {
		t.Error("alice actually decided; she should still see the outcome")
	}
	if q.CanBeReadByApprover("carol") {
		t.Error("carol never decided, so her access must end when the quote leaves approval")
	}
}

func TestQuote_NextApprovalState(t *testing.T) {
	cases := []struct {
		name       string
		chainLen   int
		stage      int
		approve    bool
		wantStage  int
		wantStatus string
	}{
		{"single-step approve completes the chain", 1, 0, true, 1, "approved"},
		{"multi-tier approve advances one step only", 3, 0, true, 1, StatusPendingApproval},
		{"multi-tier approve on middle step stays pending", 3, 1, true, 2, StatusPendingApproval},
		{"final step approve completes the chain", 3, 2, true, 3, "approved"},
		// Rejection freezes the chain where it stands rather than advancing, so the
		// audit trail shows exactly which level refused.
		{"reject on first step freezes", 3, 0, false, 0, "rejected"},
		{"reject on final step freezes", 3, 2, false, 2, "rejected"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			q := Quote{ApprovalChain: make([]ApprovalStep, tc.chainLen), ApprovalStage: tc.stage}
			gotStage, gotStatus := q.NextApprovalState(tc.approve)
			if gotStage != tc.wantStage || gotStatus != tc.wantStatus {
				t.Errorf("NextApprovalState(%v) = (%d, %q), want (%d, %q)",
					tc.approve, gotStage, gotStatus, tc.wantStage, tc.wantStatus)
			}
		})
	}
}

func TestQuote_ApprovalExpired(t *testing.T) {
	now := time.Date(2026, 8, 4, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)

	// No expiry set means never expired: quotes created before this feature, and
	// any quote with no approval policy, must keep working untouched.
	if (&Quote{}).ApprovalExpired(now) {
		t.Error("a quote with no ApprovalExpiresAt must never be considered expired")
	}
	if !(&Quote{ApprovalExpiresAt: &past}).ApprovalExpired(now) {
		t.Error("an approval window in the past must be expired")
	}
	if (&Quote{ApprovalExpiresAt: &future}).ApprovalExpired(now) {
		t.Error("an approval window in the future must not be expired")
	}
	// Exactly at the boundary is not yet expired (After is strict).
	if (&Quote{ApprovalExpiresAt: &now}).ApprovalExpired(now) {
		t.Error("the exact expiry instant must not count as expired")
	}
}

func TestQuote_CurrentStep(t *testing.T) {
	q := Quote{ApprovalChain: chain([]string{"alice"}, []string{"bob"})}

	q.ApprovalStage = 0
	if step := q.CurrentStep(); step == nil || step.Approvers[0].AccountID != "alice" {
		t.Error("stage 0 should return the first step")
	}
	// Past the end: the chain is fully resolved, so there is nothing to decide.
	q.ApprovalStage = 2
	if q.CurrentStep() != nil {
		t.Error("a stage past the end of the chain must return nil")
	}
	// Defensive: a negative stage must not panic on a slice index.
	q.ApprovalStage = -1
	if q.CurrentStep() != nil {
		t.Error("a negative stage must return nil rather than panic")
	}
	if (&Quote{}).CurrentStep() != nil {
		t.Error("a quote with no chain must return nil")
	}
}

// The gating decision now lives in ONE function. These lock its behaviour so the
// create-time and seller-approve callers cannot drift apart again — every
// divergence between those two copies became a bug where the gate either failed
// to fire or fired when it should not have.

func TestQuote_ShouldGate(t *testing.T) {
	base := func() Quote {
		return Quote{
			Items:             []cart.CartItem{{Quantity: 2}},
			GrandTotal:        1000,
			ApprovalScope:     ApprovalScopeBoth,
			ApprovalThreshold: 500,
			ApprovalChain:     chain([]string{"alice"}),
		}
	}
	cases := []struct {
		name   string
		mutate func(*Quote)
		qType  string
		want   bool
	}{
		{"over the amount threshold gates", nil, "standard", true},
		{"under the amount threshold does not", func(q *Quote) { q.GrandTotal = 100 }, "standard", false},
		{"exactly at the threshold gates", func(q *Quote) { q.GrandTotal = 500 }, "standard", true},
		{"no chain never gates", func(q *Quote) { q.ApprovalChain = nil }, "standard", false},
		{"scope none never gates", func(q *Quote) { q.ApprovalScope = ApprovalScopeNone }, "standard", false},
		{"empty scope never gates", func(q *Quote) { q.ApprovalScope = "" }, "standard", false},
		// Scope confines the gate to the flow the merchant chose.
		{"negotiable scope leaves standard alone", func(q *Quote) { q.ApprovalScope = ApprovalScopeNegotiable }, "standard", false},
		{"negotiable scope gates negotiable", func(q *Quote) { q.ApprovalScope = ApprovalScopeNegotiable }, "negotiable", true},
		{"standard scope leaves negotiable alone", func(q *Quote) { q.ApprovalScope = ApprovalScopeStandard }, "negotiable", false},
		// Quantity is an independent trigger, so a cheap bulk order still gates.
		{"quantity threshold gates on its own", func(q *Quote) {
			q.ApprovalThreshold = 0
			q.ApprovalQuantityThreshold = 2
		}, "standard", true},
		{"under the quantity threshold does not", func(q *Quote) {
			q.ApprovalThreshold = 0
			q.ApprovalQuantityThreshold = 5
		}, "standard", false},
		{"no threshold at all never gates", func(q *Quote) {
			q.ApprovalThreshold = 0
			q.ApprovalQuantityThreshold = 0
		}, "standard", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			q := base()
			if tc.mutate != nil {
				tc.mutate(&q)
			}
			if got := q.ShouldGate(tc.qType); got != tc.want {
				t.Errorf("ShouldGate(%q) = %v, want %v", tc.qType, got, tc.want)
			}
		})
	}
}

func TestQuote_SettledCopy_DrivesTheGate(t *testing.T) {
	// A quote negotiated UPWARD past its threshold. The stored total is below the
	// limit; the settled one is above it. Judging the gate on the stored total let
	// this approve itself with no sign-off at all.
	q := Quote{
		Items: []cart.CartItem{
			{Quantity: 1, Price: 400, ProposedPrice: 1200},
		},
		Subtotal:          400,
		GrandTotal:        400,
		ApprovalScope:     ApprovalScopeBoth,
		ApprovalThreshold: 1000,
		ApprovalChain:     chain([]string{"alice"}),
	}

	if q.ShouldGate("negotiable") {
		t.Fatal("precondition: the stored total is below the threshold")
	}
	settled := q.SettledCopy()
	if !settled.ShouldGate("negotiable") {
		t.Errorf("settled total %.2f is above the %.2f threshold and must gate",
			settled.GrandTotal, q.ApprovalThreshold)
	}
	// The copy must not disturb the stored quote.
	if q.Items[0].Price != 400 || q.Items[0].ProposedPrice != 1200 || q.GrandTotal != 400 {
		t.Errorf("SettledCopy mutated the original: %+v total=%v", q.Items[0], q.GrandTotal)
	}
}

func TestQuote_ApprovalRejected_DistinguishesWhoRejected(t *testing.T) {
	// Status alone is ambiguous: a seller declining a negotiation and a buyer's
	// approver refusing an order both produce status "rejected". Only the chain
	// separates them, and the seller must keep being able to revisit their own.
	sellerRejected := Quote{Status: "rejected"}
	if sellerRejected.ApprovalRejected() {
		t.Error("a seller-rejected negotiation must not read as a buyer rejection")
	}

	buyerRejected := Quote{Status: "rejected", ApprovalChain: chain([]string{"alice"})}
	buyerRejected.ApprovalChain[0].Status = ApprovalStepRejected
	if !buyerRejected.ApprovalRejected() {
		t.Error("a rejected chain step must read as a buyer rejection")
	}

	stillPending := Quote{Status: StatusPendingApproval, ApprovalChain: chain([]string{"alice"})}
	if stillPending.ApprovalRejected() {
		t.Error("an undecided chain must not read as rejected")
	}
}

func TestQuote_CanEnterApproval(t *testing.T) {
	// "rejected" is included on purpose: a seller who withdraws a quote and later
	// reinstates it must be re-gated, or reject-then-approve is a one-step bypass
	// of the buyer's entire approval policy. A BUYER's rejection is refused
	// earlier by ApprovalRejected, so this cannot overturn their decision.
	for _, s := range []string{"draft", "open", "proposed", "rejected"} {
		if !(&Quote{Status: s}).CanEnterApproval() {
			t.Errorf("status %q should be able to enter approval", s)
		}
	}
	// Re-running a chain over an order already paid for, or already through
	// approval, is never meaningful.
	for _, s := range []string{"approved", "ordered", StatusPendingApproval} {
		if (&Quote{Status: s}).CanEnterApproval() {
			t.Errorf("status %q must NOT be able to enter approval", s)
		}
	}
}

func TestApplyApprovedPricing_SubtractsPromoDiscount(t *testing.T) {
	// The settlement formula now feeds the approval gate and is persisted as the
	// amount charged, so it must agree with the create-time calculation about
	// promo. Omitting it inflated the total, mis-firing the threshold and
	// overcharging.
	q := Quote{
		Items:         []cart.CartItem{{Quantity: 2, Price: 100}},
		ShippingCost:  10,
		TaxRate:       10,
		PromoDiscount: 50,
	}
	applyApprovedPricing(&q)

	// subtotal 200, tax 20, shipping 10, promo -50
	if q.Subtotal != 200 {
		t.Errorf("subtotal = %v, want 200", q.Subtotal)
	}
	if want := 180.0; q.GrandTotal != want {
		t.Errorf("GrandTotal = %v, want %v (promo must be subtracted)", q.GrandTotal, want)
	}

	// A promo larger than the order must never produce a negative charge.
	q2 := Quote{Items: []cart.CartItem{{Quantity: 1, Price: 10}}, PromoDiscount: 500}
	applyApprovedPricing(&q2)
	if q2.GrandTotal < 0 {
		t.Errorf("GrandTotal = %v, must never be negative", q2.GrandTotal)
	}
}

func TestStageMatcher_ToleratesAbsentField(t *testing.T) {
	// approvalStage is omitted from the document when it is zero (empty values are
	// removed rather than stored), and in MongoDB {field: 0} does NOT match a
	// document where the field is absent. Without the $in arm the very first,
	// entirely uncontended approval failed its own concurrency check and came back
	// as "decided concurrently".
	m := stageMatcher(0)
	cond, ok := m.(bson.M)
	if !ok {
		t.Fatalf("stage 0 must match absent-or-zero, got a bare %T", m)
	}
	vals, ok := cond["$in"].([]interface{})
	if !ok || len(vals) != 2 {
		t.Fatalf("expected an $in over {0, nil}, got %+v", cond)
	}
	var sawZero, sawNil bool
	for _, v := range vals {
		if v == nil {
			sawNil = true
		}
		if n, isInt := v.(int); isInt && n == 0 {
			sawZero = true
		}
	}
	if !sawZero || !sawNil {
		t.Errorf("stage 0 must match both a stored 0 and an absent field, got %+v", vals)
	}

	// A non-zero stage is always present in the document, so it matches exactly —
	// keeping the guard strict where it actually detects a concurrent decision.
	if got := stageMatcher(2); got != 2 {
		t.Errorf("non-zero stage should match exactly, got %v", got)
	}
}

func TestQuote_OpenToBuyerChanges_ExcludesRejected(t *testing.T) {
	// The buyer may propose only while the quote is genuinely under negotiation.
	for _, s := range []string{"draft", "open", "proposed"} {
		if !(&Quote{Status: s}).OpenToBuyerChanges() {
			t.Errorf("status %q should be open to buyer changes", s)
		}
	}
	// pending_approval is the bypass this closes: proposing there moved a held
	// quote to "proposed" with its chain intact, and the seller's next approve
	// then took the ungated path.
	//
	// "rejected" is excluded deliberately, and this is where it differs from
	// CanEnterApproval — reviving a quote the buyer's own approver rejected leaves
	// it stuck, since ApprovalRejected still blocks the seller from approving it.
	for _, s := range []string{StatusPendingApproval, "rejected", "approved", "ordered"} {
		if (&Quote{Status: s}).OpenToBuyerChanges() {
			t.Errorf("status %q must NOT be open to buyer changes", s)
		}
	}

	// The two predicates must not silently converge.
	if (&Quote{Status: "rejected"}).OpenToBuyerChanges() == (&Quote{Status: "rejected"}).CanEnterApproval() {
		t.Error("OpenToBuyerChanges and CanEnterApproval must differ on 'rejected'")
	}
}

// --- Roadmap #21d: two-sided approval ------------------------------------

// PolicyGates is the rule ShouldGate delegates to. The seller's policy is never
// denormalised onto the quote, so it asks the rule directly — these lock the two
// paths to the same answers.
func TestPolicyGates_MatchesShouldGate(t *testing.T) {
	q := &Quote{
		ApprovalChain:             []ApprovalStep{{Name: "L1", Approvers: []Approver{{AccountID: "a"}}}},
		ApprovalScope:             ApprovalScopeBoth,
		ApprovalThreshold:         500,
		ApprovalQuantityThreshold: 10,
		GrandTotal:                600,
		Items:                     nil,
	}
	if !q.ShouldGate("standard") {
		t.Fatal("quote over its value threshold should gate")
	}
	if !PolicyGates(q.ApprovalScope, q.ApprovalThreshold, q.ApprovalQuantityThreshold,
		"standard", q.GrandTotal, q.TotalQuantity()) {
		t.Fatal("PolicyGates disagreed with ShouldGate on the same inputs")
	}
}

func TestPolicyGates_ScopeAndThresholds(t *testing.T) {
	cases := []struct {
		name                 string
		scope                string
		threshold, qty       float64
		quoteType            string
		total, totalQuantity float64
		want                 bool
	}{
		{"no scope never gates", "", 100, 0, "standard", 5000, 1, false},
		{"scope none never gates", ApprovalScopeNone, 100, 0, "standard", 5000, 1, false},
		{"scope must cover the type", ApprovalScopeNegotiable, 100, 0, "standard", 5000, 1, false},
		{"matching scope gates on value", ApprovalScopeStandard, 100, 0, "standard", 100, 1, true},
		{"below value threshold", ApprovalScopeStandard, 100, 0, "standard", 99.99, 1, false},
		{"quantity alone can gate", ApprovalScopeBoth, 0, 10, "negotiable", 5, 10, true},
		{"no threshold set never gates", ApprovalScopeBoth, 0, 0, "negotiable", 99999, 9999, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := PolicyGates(c.scope, c.threshold, c.qty, c.quoteType, c.total, c.totalQuantity); got != c.want {
				t.Fatalf("PolicyGates = %v, want %v", got, c.want)
			}
		})
	}
}

// An untagged step is a buyer step: that is what every quote written before #21d
// carries, and misreading them as seller-side would hand the selling company
// authority over decisions their customers already made.
func TestApprovalStep_SideOfDefaultsToBuyer(t *testing.T) {
	if got := (ApprovalStep{}).SideOf(); got != ApprovalSideBuyer {
		t.Fatalf("untagged step side = %q, want %q", got, ApprovalSideBuyer)
	}
	if got := (ApprovalStep{Side: ApprovalSideSeller}).SideOf(); got != ApprovalSideSeller {
		t.Fatalf("seller step side = %q, want %q", got, ApprovalSideSeller)
	}
	if got := (ApprovalStep{Side: "nonsense"}).SideOf(); got != ApprovalSideBuyer {
		t.Fatalf("unknown side = %q, want it to fall back to %q", got, ApprovalSideBuyer)
	}
}

func TestHasApprovalSide(t *testing.T) {
	q := &Quote{ApprovalChain: []ApprovalStep{
		{Name: "Sales manager", Side: ApprovalSideSeller},
		{Name: "Finance"},
	}}
	if !q.HasApprovalSide(ApprovalSideSeller) {
		t.Fatal("seller step not found")
	}
	if !q.HasApprovalSide(ApprovalSideBuyer) {
		t.Fatal("untagged step should count as buyer-side")
	}
	sellerOnly := &Quote{ApprovalChain: []ApprovalStep{{Side: ApprovalSideSeller}}}
	if sellerOnly.HasApprovalSide(ApprovalSideBuyer) {
		t.Fatal("a seller-only chain must not report a buyer side, or the place-order backstop skips the buyer's policy")
	}
}

func TestResolvedSteps_KeepsDecisionsDropsPending(t *testing.T) {
	q := &Quote{ApprovalChain: []ApprovalStep{
		{Name: "Sales manager", Side: ApprovalSideSeller, Status: ApprovalStepApproved},
		{Name: "Finance", Side: ApprovalSideSeller, Status: ApprovalStepPending},
		{Name: "Stale buyer level", Status: ""},
	}}
	got := q.ResolvedSteps()
	if len(got) != 1 || got[0].Name != "Sales manager" {
		t.Fatalf("ResolvedSteps = %+v, want only the decided seller level", got)
	}
}

// A chain can hold both sides at once. Rebuilding either half must start from
// that half: rebuilding from the whole chain re-tagged the other side's steps as
// its own, putting approvers on levels their role can never clear.
func TestStepsForSide_SplitsTheChain(t *testing.T) {
	q := &Quote{ApprovalChain: []ApprovalStep{
		{Name: "Sales manager", Side: ApprovalSideSeller},
		{Name: "Finance", Side: ApprovalSideBuyer},
		{Name: "Legacy level"}, // untagged: buyer, as every pre-#21d quote is
	}}
	seller := q.StepsForSide(ApprovalSideSeller)
	if len(seller) != 1 || seller[0].Name != "Sales manager" {
		t.Fatalf("seller half = %+v, want just the sales manager level", seller)
	}
	buyer := q.StepsForSide(ApprovalSideBuyer)
	if len(buyer) != 2 {
		t.Fatalf("buyer half = %+v, want the tagged and the untagged level", buyer)
	}
	if q.StepsForSide(ApprovalSideSeller) == nil && q.StepsForSide(ApprovalSideBuyer) == nil {
		t.Fatal("both halves empty")
	}
}

// Both organisations' levels sit on one chain, and every read path marshals the
// whole quote. Without redaction a buyer receives the seller's approvers by name
// and address plus their internal notes, and the seller receives the buyer's.
func TestRedactedFor_HidesTheOtherSidesPeopleAndNotes(t *testing.T) {
	decided := time.Now()
	q := &Quote{ApprovalChain: []ApprovalStep{
		{
			Name: "Sales manager", Side: ApprovalSideSeller, Status: ApprovalStepApproved,
			Approvers: []Approver{{AccountID: "s1", Email: "manager@seller.test", Name: "Sam"}},
			DecidedBy: &Approver{AccountID: "s1", Email: "manager@seller.test"},
			DecidedAt: &decided, Note: "margin is thin, approving anyway",
		},
		{
			Name: "Finance", Side: ApprovalSideBuyer, Status: ApprovalStepPending,
			Approvers: []Approver{{AccountID: "b1", Email: "cfo@buyer.test", Name: "Bea"}},
		},
	}}

	forBuyer := q.RedactedFor(ApprovalSideBuyer)
	seller := forBuyer.ApprovalChain[0]
	if len(seller.Approvers) != 0 || seller.DecidedBy != nil || seller.Note != "" || seller.Name != "" {
		t.Fatalf("buyer can see inside the seller's level: %+v", seller)
	}
	if seller.Status != ApprovalStepApproved || seller.SideOf() != ApprovalSideSeller {
		t.Fatalf("buyer lost the seller level's existence/status: %+v", seller)
	}
	if len(forBuyer.ApprovalChain[1].Approvers) != 1 {
		t.Fatal("buyer lost their OWN level's approvers")
	}

	forSeller := q.RedactedFor(ApprovalSideSeller)
	buyer := forSeller.ApprovalChain[1]
	if len(buyer.Approvers) != 0 || buyer.Name != "" {
		t.Fatalf("seller can see inside the buyer's level: %+v", buyer)
	}
	if forSeller.ApprovalChain[0].Note != "margin is thin, approving anyway" {
		t.Fatal("seller lost the note on their OWN level")
	}

	// The stored quote must be untouched: redaction is for the wire only.
	if q.ApprovalChain[0].Note == "" || len(q.ApprovalChain[1].Approvers) != 1 {
		t.Fatal("RedactedFor mutated the quote it was called on")
	}
}

// --- Roadmap #21f: the decision record ------------------------------------

// The record must survive a chain rebuild. buildApprovalChain strips decision
// fields so a re-submitted cart cannot carry stale approvals, and that same code
// was erasing who had approved what on a withdraw-and-reinstate.
func TestApprovalDecisions_SurviveAChainRebuild(t *testing.T) {
	at := time.Now()
	q := &Quote{
		GrandTotal: 4200,
		ApprovalChain: []ApprovalStep{
			{Name: "Finance", Status: ApprovalStepApproved,
				DecidedBy: &Approver{AccountID: "b1", Name: "Jane"}, DecidedAt: &at},
		},
		ApprovalDecisions: []ApprovalDecision{
			{Level: 1, StepName: "Finance", Decision: ApprovalStepApproved,
				By: &Approver{AccountID: "b1", Name: "Jane"}, At: at, GrandTotal: 4200},
		},
	}
	// What a withdraw-and-reinstate does to the chain.
	q.ApprovalChain = []ApprovalStep{{Name: "Finance", Status: ApprovalStepPending}}

	if len(q.ApprovalDecisions) != 1 || q.ApprovalDecisions[0].By.Name != "Jane" {
		t.Fatal("rebuilding the chain must not touch the decision record")
	}
	if q.ApprovalDecisions[0].GrandTotal != 4200 {
		t.Fatal("the entry lost the total it was decided at, so it no longer says what was approved")
	}
}

func TestNewApprovalDecision_LevelIsOneBased(t *testing.T) {
	q := &Quote{GrandTotal: 99.5}
	d := NewApprovalDecision(q, ApprovalStep{Name: "Director", Side: ApprovalSideSeller},
		1, ApprovalStepApproved, &Approver{AccountID: "s1"}, "ok", time.Now())
	if d.Level != 2 {
		t.Fatalf("stage 1 must record as level 2 to match the portal, got %d", d.Level)
	}
	if d.SideOf() != ApprovalSideSeller {
		t.Fatalf("side not carried: %q", d.SideOf())
	}
	if d.GrandTotal != 99.5 {
		t.Fatalf("total not carried: %v", d.GrandTotal)
	}
}

// The record holds exactly what must not cross the trade. Redacting the chain but
// not the log would have reopened the whole disclosure through a second field.
func TestRedactedFor_RedactsTheDecisionRecord(t *testing.T) {
	at := time.Now()
	q := &Quote{ApprovalDecisions: []ApprovalDecision{
		{Level: 1, Side: ApprovalSideSeller, StepName: "Sales manager", Decision: ApprovalStepApproved,
			By: &Approver{AccountID: "s1", Email: "manager@seller.test"}, At: at, Note: "margin is thin"},
		{Level: 2, Side: ApprovalSideBuyer, StepName: "Finance", Decision: ApprovalStepApproved,
			By: &Approver{AccountID: "b1", Email: "cfo@buyer.test"}, At: at, Note: "within budget"},
	}}

	forBuyer := q.RedactedFor(ApprovalSideBuyer)
	if forBuyer.ApprovalDecisions[0].By != nil || forBuyer.ApprovalDecisions[0].Note != "" ||
		forBuyer.ApprovalDecisions[0].StepName != "" {
		t.Fatalf("buyer can read inside the seller's decision: %+v", forBuyer.ApprovalDecisions[0])
	}
	if forBuyer.ApprovalDecisions[0].Decision != ApprovalStepApproved || forBuyer.ApprovalDecisions[0].Level != 1 {
		t.Fatal("buyer lost the fact that the seller's level was decided")
	}
	if forBuyer.ApprovalDecisions[1].Note != "within budget" {
		t.Fatal("buyer lost the note on their OWN decision")
	}

	forSeller := q.RedactedFor(ApprovalSideSeller)
	if forSeller.ApprovalDecisions[1].By != nil || forSeller.ApprovalDecisions[1].Note != "" {
		t.Fatalf("seller can read inside the buyer's decision: %+v", forSeller.ApprovalDecisions[1])
	}

	// Redaction is for the wire only.
	if q.ApprovalDecisions[0].By == nil || q.ApprovalDecisions[0].Note == "" {
		t.Fatal("RedactedFor mutated the quote it was called on")
	}
}

// An override is the one decision that crosses the boundary. It is always made by
// the seller and can be made against the BUYER's level, so tagging it by the
// level's side would hide the seller's own person from their own organisation and
// hide from the buyer who overruled their control.
func TestRedactedFor_AnOverrideKeepsItsAuthorForEveryone(t *testing.T) {
	at := time.Now()
	q := &Quote{ApprovalDecisions: []ApprovalDecision{
		// A seller force-releasing the BUYER's level: side is the level's, the
		// author is the seller's.
		{Level: 1, Side: ApprovalSideBuyer, StepName: "Finance", Decision: ApprovalStepReleased,
			By: &Approver{AccountID: "s9", Email: "ops@seller.test"}, At: at},
	}}
	for _, side := range []string{ApprovalSideBuyer, ApprovalSideSeller} {
		got := q.RedactedFor(side).ApprovalDecisions[0]
		if got.By == nil || got.By.Email != "ops@seller.test" {
			t.Fatalf("%s side cannot see who performed the override: %+v", side, got)
		}
	}
	// The buyer's own level LABEL is still theirs alone.
	if q.RedactedFor(ApprovalSideSeller).ApprovalDecisions[0].StepName != "" {
		t.Fatal("the buyer's internal level name leaked to the seller on an override")
	}
}

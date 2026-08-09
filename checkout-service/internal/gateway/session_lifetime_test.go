package gateway

import (
	"testing"
	"time"
)

// The provider's hosted checkout page outlives our session record, so OUR expiry
// must never be the thing that decides a payment failed.
//
// handlePaymentReturnRequest checks our expiry BEFORE asking the provider whether
// the customer paid, so a window shorter than the provider's silently overrules
// them: the shopper sees "expired", no order is created, and the money stays with
// the gateway. This is that invariant as a test rather than a comment, because a
// comment does not fail a build.
func TestPendingSessionLifetimeOutlivesEveryProvider(t *testing.T) {
	// Longest hosted-session lifetime across the gateways we integrate with.
	// Stripe Checkout Sessions expire 24h after creation; raise this if a gateway
	// with a longer window is added.
	const longestProviderSession = 24 * time.Hour

	if PendingSessionLifetime <= longestProviderSession {
		t.Fatalf("PendingSessionLifetime is %v, which is not longer than the provider's %v. "+
			"A shopper who pays and returns after our window expires is shown 'expired' and "+
			"gets no order while the provider holds their money.",
			PendingSessionLifetime, longestProviderSession)
	}
}

// A settled session is the only record of what happened. Reaping it on the short
// claim window is why "was this customer charged?" had to be answered by hand in
// the provider's dashboard.
func TestTerminalRetentionOutlivesTheClaimWindow(t *testing.T) {
	if TerminalSessionRetention <= PendingSessionLifetime {
		t.Fatalf("TerminalSessionRetention (%v) must outlast the claim window (%v), or a "+
			"decline or completed payment is deleted as soon as it stops being claimable",
			TerminalSessionRetention, PendingSessionLifetime)
	}
}

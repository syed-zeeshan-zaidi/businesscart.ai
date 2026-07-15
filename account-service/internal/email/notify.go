package email

import (
	"context"
	"log"
	"sync"
	"time"
)

// adminEmail is hardcoded. Alerts go to the operator inbox, not a per-tenant
// recipient. To route per service or per tenant later, refactor this to read
// from config; keeping it simple for now.
const adminEmail = "help@businesscart.ai"

// dedupWindow controls how often the same alert can fire from a single Lambda
// container. 30 min balances "tell me about the problem fast" vs. "don't flood
// me when an admin is hammering a broken endpoint." Per-container only: with
// multiple warm Lambdas you may receive 2 or 3 emails per incident window.
// Cheap to do right (in-memory only, no shared state, no extra cost).
const dedupWindow = 30 * time.Minute

var notifyDedup sync.Map // key: subject string, value: time.Time

// NotifyAdmin sends a best-effort alert to the operator inbox. Used at "this
// should never happen" sites: panic recovers, decode failures, billing-path
// errors. Send errors are swallowed because the alert path itself must never
// crash the request.
//
// Dedup'd by subject for 30 min per Lambda container. 100 errors/min becomes
// roughly 1 email per 30 min, not 100 emails per min.
//
// Reuses the existing transactional Sender. No separate config, no SES setup,
// no CloudWatch or SNS infra, $0 cost beyond the SES per-email charge already
// budgeted for transactional mail.
func NotifyAdmin(sender Sender, subject, body string) {
	if sender == nil {
		return
	}
	if last, ok := notifyDedup.Load(subject); ok {
		if t, ok := last.(time.Time); ok && time.Since(t) < dedupWindow {
			return
		}
	}
	notifyDedup.Store(subject, time.Now())

	msg := Message{
		To:       adminEmail,
		Subject:  "[BusinessCart Alert] " + subject,
		TextBody: body,
	}
	if err := sender.Send(context.Background(), msg); err != nil {
		log.Printf("WARN: NotifyAdmin send failed for %q: %v", subject, err)
	}
}

// SendContactLead delivers a new demo/contact-request lead alert to the operator
// inbox. Unlike NotifyAdmin it does NOT dedup (every lead must arrive) and it
// RETURNS the send error so the caller can log a failure. The lead is always
// persisted before this runs, so a failure here loses nothing — it only means
// "you weren't pinged; the lead is still in the portal/Mongo."
func SendContactLead(sender Sender, subject, body string) error {
	if sender == nil {
		return nil
	}
	return sender.Send(context.Background(), Message{
		To:       adminEmail,
		Subject:  "[BusinessCart Lead] " + subject,
		TextBody: body,
	})
}

// resetNotifyDedupForTest clears in-memory dedup state. Test-only helper.
func resetNotifyDedupForTest() {
	notifyDedup.Range(func(k, _ any) bool {
		notifyDedup.Delete(k)
		return true
	})
}

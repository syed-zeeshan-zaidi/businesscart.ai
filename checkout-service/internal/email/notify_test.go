package email

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

// captureSender records every Send call. Used to verify NotifyAdmin's dedup
// behavior without involving real SMTP.
type captureSender struct {
	mu       sync.Mutex
	messages []Message
	failNext bool
}

func (c *captureSender) Send(_ context.Context, msg Message) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.failNext {
		c.failNext = false
		return errors.New("simulated SMTP failure")
	}
	c.messages = append(c.messages, msg)
	return nil
}

// TestNotifyAdmin pins the alert contract. Wrong here means either a flood
// of emails on a real incident (dedup broken) or silent loss of alerts (send
// path swallowed correctly but logged so we can find it).
func TestNotifyAdmin(t *testing.T) {
	t.Run("nil sender is a no-op", func(t *testing.T) {
		resetNotifyDedupForTest()
		// Must not panic. Used in tests / dry-run setups where Sender is nil.
		NotifyAdmin(nil, "x", "y")
	})

	t.Run("first call sends", func(t *testing.T) {
		resetNotifyDedupForTest()
		s := &captureSender{}
		NotifyAdmin(s, "decode error", "shippingRate empty string")
		if len(s.messages) != 1 {
			t.Fatalf("expected 1 message, got %d", len(s.messages))
		}
		got := s.messages[0]
		if got.To != adminEmail {
			t.Errorf("To = %q, want %q", got.To, adminEmail)
		}
		if got.Subject != "[BusinessCart Alert] decode error" {
			t.Errorf("Subject = %q", got.Subject)
		}
		if got.TextBody != "shippingRate empty string" {
			t.Errorf("TextBody = %q", got.TextBody)
		}
	})

	t.Run("repeat within dedup window is dropped", func(t *testing.T) {
		resetNotifyDedupForTest()
		s := &captureSender{}
		NotifyAdmin(s, "same subject", "body 1")
		NotifyAdmin(s, "same subject", "body 2")
		NotifyAdmin(s, "same subject", "body 3")
		if len(s.messages) != 1 {
			t.Errorf("expected 1 send (dedup), got %d", len(s.messages))
		}
	})

	t.Run("different subjects bypass dedup", func(t *testing.T) {
		resetNotifyDedupForTest()
		s := &captureSender{}
		NotifyAdmin(s, "subject A", "x")
		NotifyAdmin(s, "subject B", "x")
		NotifyAdmin(s, "subject C", "x")
		if len(s.messages) != 3 {
			t.Errorf("expected 3 sends (different subjects), got %d", len(s.messages))
		}
	})

	t.Run("send failure does not crash and does not panic", func(t *testing.T) {
		resetNotifyDedupForTest()
		s := &captureSender{failNext: true}
		// Must not panic. Send error is logged and swallowed.
		NotifyAdmin(s, "transient SMTP fail", "body")
	})

	t.Run("repeat after dedup window expires sends again", func(t *testing.T) {
		resetNotifyDedupForTest()
		s := &captureSender{}
		NotifyAdmin(s, "expiring subject", "first")
		// Manually backdate the dedup entry so we can test the expiry logic
		// without sleeping 30 minutes.
		notifyDedup.Store("expiring subject", time.Now().Add(-(dedupWindow + time.Minute)))
		NotifyAdmin(s, "expiring subject", "second")
		if len(s.messages) != 2 {
			t.Errorf("expected 2 sends (window expired), got %d", len(s.messages))
		}
	})

	t.Run("100 calls within window result in 1 send (flood control)", func(t *testing.T) {
		resetNotifyDedupForTest()
		s := &captureSender{}
		for i := 0; i < 100; i++ {
			NotifyAdmin(s, "flood test", "body")
		}
		if len(s.messages) != 1 {
			t.Errorf("expected 1 send, got %d (flood control broken)", len(s.messages))
		}
	})
}

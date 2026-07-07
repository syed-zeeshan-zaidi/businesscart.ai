package conversion

import (
	"context"
	"log"
	"time"
)

// Service decrypts per-seller credentials and dispatches an event to every
// provider the seller has configured. Best-effort by contract: it never
// panics out and never returns an error the caller must handle.
type Service struct {
	registry *Registry
	aesKey   []byte
}

// NewService builds the dispatch service. aesKey is the dedicated 32-byte key
// from ParseKey(CONVERSION_ENCRYPTION_KEY) — never derived from JWT_SECRET.
func NewService(registry *Registry, aesKey []byte) *Service {
	return &Service{registry: registry, aesKey: aesKey}
}

// Send dispatches ev to each provider present in encCredsByProvider (the
// seller's accounts.adConversions map: provider -> {field -> encrypted value}).
// Runs synchronously under a short timeout (safe in Lambda), recovers from any
// panic, and returns per-provider results for the Analytics view. A seller with
// no configured providers yields nil.
func (s *Service) Send(ev Event, encCredsByProvider map[string]map[string]string) (results []Result) {
	if s == nil || len(encCredsByProvider) == 0 {
		return nil
	}
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[conversion] recovered panic event=%s id=%s: %v", ev.EventName, ev.EventID, r)
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 2500*time.Millisecond)
	defer cancel()

	for provider, encCreds := range encCredsByProvider {
		d, ok := s.registry.Get(provider)
		if !ok {
			continue
		}
		creds := make(map[string]string, len(encCreds))
		decErr := false
		for k, v := range encCreds {
			p, err := Decrypt(s.aesKey, v)
			if err != nil {
				log.Printf("[conversion] decrypt failed provider=%s field=%s: %v", provider, k, err)
				decErr = true
				break
			}
			creds[k] = p
		}
		if decErr {
			results = append(results, Result{Provider: provider, Status: "failed", Error: "decrypt"})
			continue
		}

		res, err := d.Send(ctx, ev, creds)
		if err != nil {
			log.Printf("[conversion] %s send failed event=%s id=%s: %v", provider, ev.EventName, ev.EventID, err)
			results = append(results, Result{Provider: provider, Status: "failed", Error: err.Error()})
			continue
		}
		if res.Skipped {
			continue // deliberate no-op (e.g. no gclid on organic traffic): not a conversion, not a failure
		}
		log.Printf("[conversion] %s %s sent id=%s ref=%s match=%d", provider, ev.EventName, ev.EventID, res.ProviderRef, res.MatchFields)
		results = append(results, Result{
			Provider:    provider,
			Status:      "sent",
			ProviderRef: res.ProviderRef,
			MatchFields: res.MatchFields,
		})
	}
	return results
}

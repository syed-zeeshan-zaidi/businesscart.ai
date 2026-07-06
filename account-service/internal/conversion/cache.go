package conversion

import (
	"sync"
	"time"
)

// ConfigCache is a per-seller, TTL'd cache of the enabled ad-conversion
// credentials (provider -> {field -> encrypted value}). In a warm Lambda
// container it collapses the per-event account read to ~one DB hit per seller
// per TTL; the rest are map lookups. Negative results (no enabled providers)
// are cached too, so unconfigured sellers also skip repeat reads. Safe for
// concurrent use.
type ConfigCache struct {
	ttl   time.Duration
	mu    sync.RWMutex
	items map[string]cacheEntry
}

type cacheEntry struct {
	creds     map[string]map[string]string
	expiresAt time.Time
}

func NewConfigCache(ttl time.Duration) *ConfigCache {
	return &ConfigCache{ttl: ttl, items: make(map[string]cacheEntry)}
}

// Get returns the seller's enabled creds, calling load() only on a miss or
// after expiry. load may return an empty/nil map (no enabled providers) — that
// result is cached as well.
func (c *ConfigCache) Get(sellerID string, load func() map[string]map[string]string) map[string]map[string]string {
	c.mu.RLock()
	e, ok := c.items[sellerID]
	c.mu.RUnlock()
	if ok && time.Now().Before(e.expiresAt) {
		return e.creds
	}

	creds := load()

	c.mu.Lock()
	c.items[sellerID] = cacheEntry{creds: creds, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()
	return creds
}

// Invalidate drops a seller's cached entry so the next Get reloads. Called when
// a company changes its conversion config so the change is picked up promptly
// (on the container that served the change; other containers refresh by TTL).
func (c *ConfigCache) Invalidate(sellerID string) {
	c.mu.Lock()
	delete(c.items, sellerID)
	c.mu.Unlock()
}

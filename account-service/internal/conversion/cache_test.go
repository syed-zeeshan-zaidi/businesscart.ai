package conversion

import (
	"testing"
	"time"
)

func TestConfigCacheHitMissAndInvalidate(t *testing.T) {
	c := NewConfigCache(time.Minute)
	loads := 0
	loader := func() map[string]map[string]string {
		loads++
		return map[string]map[string]string{"meta": {"pixel_id": "enc"}}
	}

	// First Get is a miss -> loads once.
	got := c.Get("s1", loader)
	if loads != 1 || len(got) != 1 {
		t.Fatalf("first Get: loads=%d got=%v", loads, got)
	}
	// Second Get within TTL is a hit -> no reload.
	c.Get("s1", loader)
	if loads != 1 {
		t.Errorf("cached Get should not reload, loads=%d", loads)
	}
	// Invalidate forces the next Get to reload.
	c.Invalidate("s1")
	c.Get("s1", loader)
	if loads != 2 {
		t.Errorf("after Invalidate, Get should reload, loads=%d", loads)
	}
}

func TestConfigCacheNegativeResultCached(t *testing.T) {
	c := NewConfigCache(time.Minute)
	loads := 0
	loader := func() map[string]map[string]string {
		loads++
		return map[string]map[string]string{} // no enabled providers
	}
	c.Get("s2", loader)
	c.Get("s2", loader)
	if loads != 1 {
		t.Errorf("negative (empty) result must be cached too, loads=%d", loads)
	}
}

func TestConfigCacheExpiry(t *testing.T) {
	c := NewConfigCache(10 * time.Millisecond)
	loads := 0
	loader := func() map[string]map[string]string {
		loads++
		return nil
	}
	c.Get("s3", loader)
	time.Sleep(20 * time.Millisecond)
	c.Get("s3", loader)
	if loads != 2 {
		t.Errorf("expired entry must reload, loads=%d", loads)
	}
}

package conversion

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// hashNormalized trims + lowercases then SHA-256 hex-encodes, per the
// Meta/Google normalization rules. Empty input returns "" (never hash empty).
func hashNormalized(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// hashPhone keeps digits only (Meta requires no symbols/spaces) before hashing.
func hashPhone(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	if digits == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(digits))
	return hex.EncodeToString(sum[:])
}

// buildFbc builds the Meta `fbc` value from an fbclid:
// fb.<subdomainIndex>.<creationTimeMillis>.<fbclid>. Subdomain index 1; event
// time used as the creation time (click time is not stored). "" if no fbclid.
func buildFbc(fbclid string, t time.Time) string {
	if fbclid == "" {
		return ""
	}
	return fmt.Sprintf("fb.1.%d.%s", t.UnixMilli(), fbclid)
}

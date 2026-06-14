package generator

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

// feedDef describes a shopping channel feed format.
type feedDef struct {
	prefix string // filename prefix: "gs", "fb", etc.
	ext    string // file extension: ".xml", ".csv", ".tsv"
	build  func(StorefrontData) ([]byte, error)
}

// feedRegistry maps channel keys to their definitions.
// To add a new channel: add one build function + one entry here.
var feedRegistry = map[string]feedDef{
	"google":         {"gs", ".xml", buildGoogleFeed},
	"google_reviews": {"gr", ".xml", buildGoogleReviewsFeed},
	"facebook":       {"fb", ".csv", buildFacebookFeed},
	"bing":           {"bg", ".tsv", buildBingFeed},
	"pinterest":      {"pt", ".csv", buildPinterestFeed},
	"tiktok":         {"tt", ".csv", buildTikTokFeed},
}

// FeedFileName returns the unguessable filename for a feed channel.
func FeedFileName(channel, uniqueIdentifier string) string {
	def, ok := feedRegistry[channel]
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s-%s%s", def.prefix, uniqueIdentifier, def.ext)
}

// SupportedFeeds returns the list of valid feed channel keys.
func SupportedFeeds() []string {
	keys := make([]string, 0, len(feedRegistry))
	for k := range feedRegistry {
		keys = append(keys, k)
	}
	return keys
}

// generateFeeds runs after the main storefront is fully generated and uploaded.
// Each feed is isolated — a failure in one never affects the storefront or other feeds.
func (g *Generator) generateFeeds(data StorefrontData, companyDir string) {
	if data.Company == nil || len(data.Company.Feeds) == 0 {
		return
	}

	// Create feeds subdirectory
	feedsDir := filepath.Join(companyDir, "feeds")
	if err := os.MkdirAll(feedsDir, 0755); err != nil {
		log.Printf("[feeds] FAIL: could not create feeds directory: %v", err)
		return
	}

	log.Printf("[feeds] Generating %d feed(s) for %s", len(data.Company.Feeds), data.Company.Name)

	for _, key := range data.Company.Feeds {
		g.generateSingleFeed(key, data, feedsDir)
	}
}

// generateSingleFeed generates one feed in complete isolation.
// Panics are recovered, errors are logged, nothing is propagated.
func (g *Generator) generateSingleFeed(key string, data StorefrontData, feedsDir string) {
	start := time.Now()

	defer func() {
		if r := recover(); r != nil {
			log.Printf("[feed] PANIC: %s feed crashed: %v — storefront unaffected", key, r)
		}
	}()

	def, ok := feedRegistry[key]
	if !ok {
		log.Printf("[feed] SKIP: unknown channel %q", key)
		return
	}

	content, err := def.build(data)
	if err != nil {
		log.Printf("[feed] FAIL: %s — %v", key, err)
		return
	}

	filename := FeedFileName(key, data.Company.UniqueIdentifier)
	feedPath := filepath.Join(feedsDir, filename)
	if err := os.WriteFile(feedPath, content, 0644); err != nil {
		log.Printf("[feed] FAIL: %s write error — %v", key, err)
		return
	}

	log.Printf("[feed] OK: %s → feeds/%s (%d bytes, %dms)", key, filename, len(content), time.Since(start).Milliseconds())
}

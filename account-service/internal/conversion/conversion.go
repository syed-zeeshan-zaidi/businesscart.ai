// Package conversion sends server-side ad-platform conversion events (Meta
// Conversions API today; Google later) from the storefront tracker event
// stream. It is invoked by the visitor-event handler, owns all hashing and
// platform formatting, and is strictly best-effort: a failure here must never
// affect visitor-event ingestion. stdlib only, no third-party SDK.
//
// Credentials live encrypted on the seller's company account
// (accounts.adConversions), read via GetAccountByID. Results are written back
// as visitor-milestone metadata for the Analytics view. No new collection.
package conversion

import (
	"context"
	"time"
)

// Provider names.
const (
	ProviderMeta = "meta"
)

// supportedProviders is the allowlist of providers that have a real dispatcher.
// The dispatch path already ignores unknown providers, but inbound config is
// also validated against this so arbitrary provider keys never get persisted on
// the account document. Extend when a new dispatcher is added (e.g. Google).
var supportedProviders = map[string]bool{ProviderMeta: true}

// IsSupportedProvider reports whether name is a known ad-conversion provider.
func IsSupportedProvider(name string) bool { return supportedProviders[name] }

// Content is one line item, used for itemized event data (Meta
// content_ids/contents). ProductID is the same p.ID used as the Facebook feed
// `id` and Google Merchant `g:id`, so one value matches the catalog everywhere.
type Content struct {
	ProductID string
	Quantity  int
	ItemPrice float64
}

// Event is the neutral, un-hashed conversion the caller builds from a tracker
// event. Dispatchers own hashing + platform formatting.
type Event struct {
	EventName string // "Purchase" | "ViewContent" | "AddToCart"
	SellerID  string
	EventID   string // dedup key (event_id / order_id)
	EventTime time.Time
	Value     float64
	Currency  string

	// Identity (raw; each dispatcher hashes what its platform requires).
	Email      string
	Phone      string
	FirstName  string
	LastName   string
	City       string
	State      string
	Zip        string
	Country    string
	ExternalID string
	ClientIP   string
	ClientUA   string
	Fbclid     string
	Gclid      string

	Contents []Content
}

// SendResult is a dispatcher's success detail.
type SendResult struct {
	ProviderRef string
	MatchFields int // number of user_data match keys sent (EMQ proxy for analytics)
}

// Result is the neutral outcome of one provider dispatch, surfaced to analytics.
// bson tags so it persists cleanly inside visitor-milestone metadata.
type Result struct {
	Provider    string `bson:"provider" json:"provider"`
	Status      string `bson:"status" json:"status"` // "sent" | "failed"
	ProviderRef string `bson:"ref,omitempty" json:"ref,omitempty"`
	MatchFields int    `bson:"matchFields,omitempty" json:"matchFields,omitempty"`
	Error       string `bson:"error,omitempty" json:"error,omitempty"`
}

// Dispatcher sends one event to one ad platform.
type Dispatcher interface {
	Provider() string
	Send(ctx context.Context, ev Event, creds map[string]string) (SendResult, error)
}

// Registry maps provider name to dispatcher. Mirrors gateway.Registry.
type Registry struct {
	dispatchers map[string]Dispatcher
}

func NewRegistry() *Registry {
	return &Registry{dispatchers: make(map[string]Dispatcher)}
}

func (r *Registry) Register(d Dispatcher) { r.dispatchers[d.Provider()] = d }

func (r *Registry) Get(name string) (Dispatcher, bool) {
	d, ok := r.dispatchers[name]
	return d, ok
}

package conversion

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const metaGraphVersion = "v21.0"

// MetaDispatcher sends events to the Meta Conversions API. stdlib http only.
type MetaDispatcher struct {
	client  *http.Client
	baseURL string // overridable in tests; defaults to the Graph API host
}

func NewMetaDispatcher() *MetaDispatcher {
	return &MetaDispatcher{
		client:  &http.Client{Timeout: 3 * time.Second},
		baseURL: "https://graph.facebook.com",
	}
}

func (m *MetaDispatcher) Provider() string { return ProviderMeta }

// Send POSTs one event to the Meta CAPI. creds requires pixel_id + access_token.
// Returns the fbtrace_id and the number of user_data match keys sent.
func (m *MetaDispatcher) Send(ctx context.Context, ev Event, creds map[string]string) (SendResult, error) {
	pixelID := creds["pixel_id"]
	token := creds["access_token"]
	if pixelID == "" || token == "" {
		return SendResult{}, fmt.Errorf("meta: missing pixel_id or access_token")
	}

	userData := map[string]interface{}{}
	setHash := func(key, val string) {
		if h := hashNormalized(val); h != "" {
			userData[key] = []string{h}
		}
	}
	setHash("em", ev.Email)
	if h := hashPhone(ev.Phone); h != "" {
		userData["ph"] = []string{h}
	}
	setHash("fn", ev.FirstName)
	setHash("ln", ev.LastName)
	setHash("ct", ev.City)
	setHash("st", ev.State)
	setHash("zp", ev.Zip)
	setHash("country", ev.Country)
	setHash("external_id", ev.ExternalID)
	// IP + User-Agent are sent raw and are the highest-impact match signals.
	if ev.ClientIP != "" {
		userData["client_ip_address"] = ev.ClientIP
	}
	if ev.ClientUA != "" {
		userData["client_user_agent"] = ev.ClientUA
	}
	if fbc := buildFbc(ev.Fbclid, ev.EventTime); fbc != "" {
		userData["fbc"] = fbc
	}

	customData := map[string]interface{}{}
	if ev.Value > 0 {
		customData["value"] = ev.Value
		customData["currency"] = strings.ToUpper(defaultCurrency(ev.Currency))
	}
	if ev.EventID != "" {
		customData["order_id"] = ev.EventID
	}
	if len(ev.Contents) > 0 {
		contents := make([]map[string]interface{}, 0, len(ev.Contents))
		ids := make([]string, 0, len(ev.Contents))
		numItems := 0
		for _, c := range ev.Contents {
			contents = append(contents, map[string]interface{}{
				"id": c.ProductID, "quantity": c.Quantity, "item_price": c.ItemPrice,
			})
			ids = append(ids, c.ProductID)
			numItems += c.Quantity
		}
		customData["content_type"] = "product"
		customData["contents"] = contents
		customData["content_ids"] = ids
		customData["num_items"] = numItems
	}

	event := map[string]interface{}{
		"event_name":    ev.EventName,
		"event_time":    ev.EventTime.Unix(),
		"event_id":      ev.EventID, // dedup
		"action_source": "website",
		"user_data":     userData,
	}
	if len(customData) > 0 {
		event["custom_data"] = customData
	}

	payload := map[string]interface{}{"data": []interface{}{event}}
	body, err := json.Marshal(payload)
	if err != nil {
		return SendResult{}, err
	}

	url := fmt.Sprintf("%s/%s/%s/events?access_token=%s", m.baseURL, metaGraphVersion, pixelID, token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return SendResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := m.client.Do(req)
	if err != nil {
		return SendResult{}, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return SendResult{}, fmt.Errorf("meta CAPI %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	var parsed struct {
		FbtraceID string `json:"fbtrace_id"`
	}
	_ = json.Unmarshal(respBody, &parsed)
	return SendResult{ProviderRef: parsed.FbtraceID, MatchFields: len(userData)}, nil
}

func defaultCurrency(c string) string {
	if c == "" {
		return "USD"
	}
	return c
}

package generator

import (
	"business-cart/account-service/internal/storage"
	"fmt"
	"testing"
	"time"
)

// TestGoogleReviewsFeed_PrintSample is a debug helper. Run with:
//   go test ./internal/generator/ -run TestGoogleReviewsFeed_PrintSample -v
// It dumps a sample XML for manual inspection against the spec.
func TestGoogleReviewsFeed_PrintSample(t *testing.T) {
	verified := true
	data := StorefrontData{
		Domain: "www.usetgo.com",
		Company: &storage.CompanyData{
			Name:    "uSetGo",
			LogoURL: "https://www.usetgo.com/favicon.ico",
		},
		Products: []ProductData{
			{
				ID:       "68d587240f94e737534b8866",
				Name:     "Adult Welding Gloves",
				SKU:      "AWG-001",
				Filename: "adult-welding-gloves-4b8866",
				Active:   &verified,
				Rating: &Rating{
					Count: 2, Average: 4.5,
					Reviews: []Review{
						{Name: "Mark T.", Rating: 5, Title: "Worth the extra",
							Body: "Cuff is long enough for overhead MIG work.",
							Verified: true,
							Date: time.Date(2026, 5, 18, 10, 30, 0, 0, time.UTC)},
						{Rating: 4, Body: "Solid for the price.",
							Date: time.Date(2026, 4, 8, 0, 0, 0, 0, time.UTC)},
					},
				},
			},
		},
	}
	out, err := buildGoogleReviewsFeed(data)
	if err != nil {
		t.Fatalf("build failed: %v", err)
	}
	fmt.Printf("\n========= SAMPLE FEED OUTPUT =========\n%s\n========= END =========\n", string(out))
}

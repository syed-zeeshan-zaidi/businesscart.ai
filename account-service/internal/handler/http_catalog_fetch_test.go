package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// A failed catalog read must surface as an error, never as an empty catalog. Reporting
// failure as "no products" makes triggerD2CGeneration republish the live storefront and
// the Shopping feed with nothing in them.

func TestFetchCompanyProducts_NonOKStatusIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"Unauthorized: Invalid token"}`))
	}))
	defer srv.Close()
	t.Setenv("CATALOG_SERVICE_URL", srv.URL)

	h := &LambdaHandler{}
	got, err := h.fetchCompanyProducts("companyA", "tok")
	if err == nil {
		t.Fatal("401 from catalog-service must be an error, not an empty catalog")
	}
	if got != nil {
		t.Errorf("expected nil products on failure, got %+v", got)
	}
}

func TestFetchCompanyProducts_MalformedBodyIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`not json`))
	}))
	defer srv.Close()
	t.Setenv("CATALOG_SERVICE_URL", srv.URL)

	h := &LambdaHandler{}
	if _, err := h.fetchCompanyProducts("companyA", "tok"); err == nil {
		t.Fatal("undecodable response must be an error, not an empty catalog")
	}
}

func TestFetchCompanyProducts_MissingURLIsError(t *testing.T) {
	t.Setenv("CATALOG_SERVICE_URL", "")

	h := &LambdaHandler{}
	if _, err := h.fetchCompanyProducts("companyA", "tok"); err == nil {
		t.Fatal("unset CATALOG_SERVICE_URL must be an error, not an empty catalog")
	}
}

// The counterpart: a company that genuinely has no products must still generate, so an
// empty-but-successful response is not an error. This is what keeps onboarding working.
func TestFetchCompanyProducts_EmptyCatalogIsNotAnError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`[]`))
	}))
	defer srv.Close()
	t.Setenv("CATALOG_SERVICE_URL", srv.URL)

	h := &LambdaHandler{}
	got, err := h.fetchCompanyProducts("companyA", "tok")
	if err != nil {
		t.Fatalf("a company with no products must generate normally, got error: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected 0 products, got %d", len(got))
	}
}

// DiscountedPrice is derived here (DealPrice is a percentage), and the storefront and
// feeds publish it as sale_price, so pin the arithmetic.
func TestFetchCompanyProducts_DerivesDiscountedPrice(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`[
			{"_id":"1","sellerID":"companyA","name":"Deal","price":69.99,"dealPrice":43},
			{"_id":"2","sellerID":"companyA","name":"No deal","price":40}
		]`))
	}))
	defer srv.Close()
	t.Setenv("CATALOG_SERVICE_URL", srv.URL)

	h := &LambdaHandler{}
	got, err := h.fetchCompanyProducts("companyA", "tok")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 products, got %d", len(got))
	}
	if diff := got[0].DiscountedPrice - 39.8943; diff > 0.0001 || diff < -0.0001 {
		t.Errorf("43%% off 69.99 should be 39.8943, got %v", got[0].DiscountedPrice)
	}
	if got[1].DiscountedPrice != 0 {
		t.Errorf("no dealPrice should leave DiscountedPrice zero, got %v", got[1].DiscountedPrice)
	}
	if got[0].SellerID != "companyA" {
		t.Errorf("sellerID must survive decoding for the ownership check, got %q", got[0].SellerID)
	}
}

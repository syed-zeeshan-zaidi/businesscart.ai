package handler

import (
	"testing"

	"business-cart/account-service/internal/auth"
	"business-cart/account-service/internal/generator"
	"business-cart/account-service/internal/storage"
	"github.com/golang-jwt/jwt/v5"
)

// A generated storefront is a public, single-tenant artifact. These tests pin the
// invariant that nothing belonging to another company can reach it, which is what
// broke when an admin-triggered regeneration fetched every seller's catalog.

func boolPtr(b bool) *bool { return &b }

func TestOwnedProducts_DropsForeignSellers(t *testing.T) {
	const me = "68d46f98e4dc5dd472e33655"
	const other = "68dd7fc014ed94cd4d438270"

	in := []generator.ProductData{
		{ID: "1", SellerID: me, Name: "Mine active"},
		{ID: "2", SellerID: other, Name: "Foreign active"},
		{ID: "3", SellerID: me, Name: "Mine inactive", Active: boolPtr(false)},
		{ID: "4", SellerID: "", Name: "No seller"},
		{ID: "5", SellerID: me, Name: "Mine explicit active", Active: boolPtr(true)},
	}

	got := ownedProducts(in, me)

	if len(got) != 2 {
		t.Fatalf("expected 2 products, got %d: %+v", len(got), got)
	}
	for _, p := range got {
		if p.SellerID != me {
			t.Errorf("product %s leaked from seller %q", p.ID, p.SellerID)
		}
	}
	if got[0].ID != "1" || got[1].ID != "5" {
		t.Errorf("unexpected products kept: %s, %s", got[0].ID, got[1].ID)
	}
}

func TestOwnedBlogPosts_DropsForeignSellers(t *testing.T) {
	const me = "68d46f98e4dc5dd472e33655"
	const other = "68dd7fc014ed94cd4d438270"

	in := []generator.BlogPostData{
		{ID: "1", SellerID: me, Title: "Mine"},
		{ID: "2", SellerID: other, Title: "Foreign"},
		{ID: "3", SellerID: me, Title: "Mine inactive", Active: boolPtr(false)},
	}

	got := ownedBlogPosts(in, me)

	if len(got) != 1 {
		t.Fatalf("expected 1 post, got %d: %+v", len(got), got)
	}
	if got[0].SellerID != me {
		t.Errorf("post %s leaked from seller %q", got[0].ID, got[0].SellerID)
	}
}

// An all-foreign catalog, which is exactly what an admin-scoped fetch used to return,
// must publish nothing rather than another tenant's storefront.
func TestOwnedProducts_AllForeignYieldsNothing(t *testing.T) {
	in := []generator.ProductData{
		{ID: "1", SellerID: "companyA"},
		{ID: "2", SellerID: "companyB"},
	}
	if got := ownedProducts(in, "companyC"); len(got) != 0 {
		t.Fatalf("expected 0 products, got %d", len(got))
	}
}

// Nil-slice-when-empty matches the inline filter this replaced, so downstream JSON
// and template behaviour is unchanged.
func TestOwnedProducts_EmptyInputReturnsNil(t *testing.T) {
	if got := ownedProducts(nil, "companyA"); got != nil {
		t.Fatalf("expected nil slice, got %+v", got)
	}
}

// Pins the cross-service contract: the token triggerD2CGeneration mints must satisfy
// catalog-service's validation and resolve to this company alone. Mirrors exactly how
// catalog-service reads it (HandleRequest claim parsing, then getProducts role switch).
func TestScopedToken_ResolvesToCompanyTenantInCatalogService(t *testing.T) {
	const secret = "test-secret"
	const companyID = "68d46f98e4dc5dd472e33655"

	tok, err := auth.GenerateJWT(companyID, companyID, storage.OrgRoleOwner, "owner@example.com", storage.RoleCompany, secret, nil, nil, nil)
	if err != nil {
		t.Fatalf("mint failed: %v", err)
	}

	parsed, err := jwt.Parse(tok, func(*jwt.Token) (interface{}, error) { return []byte(secret), nil })
	if err != nil || !parsed.Valid {
		t.Fatalf("catalog-service would reject token: %v", err)
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("claims not MapClaims")
	}
	userClaim, ok := claims["user"].(map[string]interface{})
	if !ok {
		t.Fatal("user claim is not a map")
	}
	role, _ := userClaim["role"].(string)
	id, _ := userClaim["id"].(string)
	if role == "" || id == "" {
		t.Fatalf("catalog-service requires non-empty role and id, got role=%q id=%q", role, id)
	}
	if role != "company" {
		t.Fatalf("token must be company-scoped, got role=%q (admin returns every seller)", role)
	}
	if id != companyID {
		t.Fatalf("tenant mismatch: filter would be sellerID=%q, want %q", id, companyID)
	}
}

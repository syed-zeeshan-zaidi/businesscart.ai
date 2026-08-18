package storage

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// EffectiveOrgRole is derived rather than migrated, so the property that matters
// most is that every account which exists TODAY keeps the access it has: they are
// all their own root, and a root is the owner.
func TestEffectiveOrgRole(t *testing.T) {
	root := primitive.NewObjectID()
	cases := []struct {
		name    string
		account Account
		want    string
	}{
		{"a root is the owner", Account{ID: root}, OrgRoleOwner},
		{"a root's stored value cannot demote it",
			Account{ID: root, OrgRole: OrgRoleUser}, OrgRoleOwner},
		{"a joiner defaults to user",
			Account{ID: primitive.NewObjectID(), ParentAccountID: root.Hex()}, OrgRoleUser},
		{"a joiner can be promoted to admin",
			Account{ID: primitive.NewObjectID(), ParentAccountID: root.Hex(), OrgRole: OrgRoleAdmin}, OrgRoleAdmin},
		{"an unrecognised value falls to the LEAST privileged role",
			Account{ID: primitive.NewObjectID(), ParentAccountID: root.Hex(), OrgRole: "superuser"}, OrgRoleUser},
		{"an empty value falls to the least privileged role",
			Account{ID: primitive.NewObjectID(), ParentAccountID: root.Hex(), OrgRole: ""}, OrgRoleUser},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := c.account.EffectiveOrgRole(); got != c.want {
				t.Fatalf("EffectiveOrgRole() = %q, want %q", got, c.want)
			}
		})
	}
}

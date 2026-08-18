package handler

import (
	"strings"
	"testing"

	"business-cart/account-service/internal/storage"
)

func step(n int) storage.ApprovalStepConfig {
	s := storage.ApprovalStepConfig{}
	for i := 0; i < n; i++ {
		s.Approvers = append(s.Approvers, storage.Approver{Email: "a@b.test"})
	}
	return s
}

// The bounds check runs BEFORE resolveApprovers, which fills in account ids from
// emails. It must therefore judge only the shape of what the request carried.
// Requiring an account id here rejected every valid policy, which is what
// happened when the two calls were simply swapped: "approval level 1 approver 1
// is missing an account" on a policy that was perfectly fine.
func TestValidateApprovalPolicyBounds_IgnoresUnresolvedIdentity(t *testing.T) {
	p := &storage.ApprovalPolicy{
		Scope: storage.ApprovalScopeBoth, Threshold: 100,
		Chain: []storage.ApprovalStepConfig{step(1)}, // email only, no accountId yet
	}
	if err := validateApprovalPolicyBounds(p); err != nil {
		t.Fatalf("bounds rejected a policy that has not been resolved yet: %v", err)
	}
}

// ...but it must still catch an oversized chain, which is the whole reason it
// runs first: resolveApprovers issues one DB lookup per named approver.
func TestValidateApprovalPolicyBounds_CatchesOversizeBeforeAnyLookup(t *testing.T) {
	var chain []storage.ApprovalStepConfig
	for i := 0; i < MaxApprovalSteps+1; i++ {
		chain = append(chain, step(1))
	}
	err := validateApprovalPolicyBounds(&storage.ApprovalPolicy{
		Scope: storage.ApprovalScopeBoth, Threshold: 1, Chain: chain})
	if err == nil {
		t.Fatal("an oversized chain passed the pre-resolution bounds check")
	}

	wide := &storage.ApprovalPolicy{Scope: storage.ApprovalScopeBoth, Threshold: 1,
		Chain: []storage.ApprovalStepConfig{step(MaxApproversPerStep + 1)}}
	if err := validateApprovalPolicyBounds(wide); err == nil {
		t.Fatal("an oversized level passed the pre-resolution bounds check")
	}
}

// The full check runs after resolution and DOES require identity, because a
// chain that names somebody unreachable can never be cleared or notified.
func TestValidateApprovalPolicy_RequiresResolvedIdentity(t *testing.T) {
	unresolved := &storage.ApprovalPolicy{Scope: storage.ApprovalScopeBoth, Threshold: 1,
		Chain: []storage.ApprovalStepConfig{step(1)}}
	err := validateApprovalPolicy(unresolved)
	if err == nil || !strings.Contains(err.Error(), "missing an account") {
		t.Fatalf("the post-resolution check must require an account id, got %v", err)
	}

	resolved := &storage.ApprovalPolicy{Scope: storage.ApprovalScopeBoth, Threshold: 1,
		Chain: []storage.ApprovalStepConfig{{Approvers: []storage.Approver{
			{AccountID: "abc", Email: "a@b.test"}}}}}
	if err := validateApprovalPolicy(resolved); err != nil {
		t.Fatalf("a fully resolved policy was rejected: %v", err)
	}
}

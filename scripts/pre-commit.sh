#!/usr/bin/env bash
#
# Fast local pre-commit gate. Mirrors the CI code-quality.yml checks
# (build / gofmt / go vet / go mod tidy / go test, plus web-portal lint + type
# check) but scoped to the areas you actually touched, so it stays fast.
#
# Heavy integration tests (backend-flow, storefront validator, storefront e2e)
# are NOT here — they need a live stack and run in scripts/pre-push.sh instead.
#
# Called by .githooks/pre-commit. Exit non-zero blocks the commit (use
# `git commit --no-verify` to bypass in a pinch).
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
fail=0

# Only look at what's staged for this commit.
staged=$(git diff --cached --name-only --diff-filter=ACMR)
if [ -z "$staged" ]; then
    exit 0
fi

changed() { echo "$staged" | grep -q "$1"; }

# gofmt only the .go files staged in THIS commit (never vendor/, never
# pre-existing issues in files you didn't touch — those aren't yours to fix here).
staged_go=$(echo "$staged" | grep '\.go$' | grep -v '/vendor/' || true)
if [ -n "$staged_go" ]; then
    unformatted=$(gofmt -l $staged_go 2>/dev/null || true)
    if [ -n "$unformatted" ]; then
        echo -e "${RED}✗ gofmt: staged files need formatting (run: gofmt -w <file>):${NC}"
        echo "$unformatted"
        fail=1
    fi
fi

check_go_service() {
    local svc="$1"
    echo -e "${YELLOW}▶ $svc${NC}"
    (
        cd "$svc" || exit 1
        go build ./... || { echo -e "${RED}✗ build failed${NC}"; exit 1; }
        go vet ./... || { echo -e "${RED}✗ go vet failed${NC}"; exit 1; }
        go mod tidy -diff >/dev/null 2>&1 || { echo -e "${RED}✗ go.mod/go.sum not tidy (run: go mod tidy)${NC}"; exit 1; }
        go test ./... || { echo -e "${RED}✗ tests failed${NC}"; exit 1; }
    ) || return 1
    echo -e "${GREEN}✓ $svc${NC}"
}

for svc in account-service catalog-service checkout-service; do
    if changed "^$svc/"; then
        check_go_service "$svc" || fail=1
    fi
done

if changed "^web-portal/"; then
    echo -e "${YELLOW}▶ web-portal${NC}"
    (
        cd web-portal || exit 1
        # Type-check without emitting: catches the same type errors as the CI
        # build but skips vite's dist write (which trips on a root-owned dist/).
        npm run lint || { echo -e "${RED}✗ lint failed${NC}"; exit 1; }
        npx tsc --noEmit || { echo -e "${RED}✗ tsc type-check failed${NC}"; exit 1; }
    ) && echo -e "${GREEN}✓ web-portal${NC}" || fail=1
fi

if [ "$fail" -ne 0 ]; then
    echo -e "${RED}pre-commit checks failed — fix the above or use 'git commit --no-verify' to bypass.${NC}"
    exit 1
fi
echo -e "${GREEN}pre-commit checks passed.${NC}"
exit 0

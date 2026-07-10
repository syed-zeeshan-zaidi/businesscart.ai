#!/usr/bin/env bash
#
# Heavy local pre-push suite. Runs the integration tests that CI structurally
# cannot (they need a live SAM stack + MongoDB + Mailpit + Stripe sandbox):
#   1. backend-flow-test.py      — full cross-service API suite
#   2. validate-storefront.py    — storefront regen + JSON-LD + Lighthouse
#   3. e2e-storefront.py         — headless guest checkout + Stripe card payment
#
# Prerequisites are checked, not assumed. When the stack isn't up, or the
# secrets aren't available, the affected step is SKIPPED WITH A WARNING rather
# than failing — so this never blocks a legitimate push from a machine that
# can't run it. Real test failures still block.
#
# Called by .githooks/pre-push. Bypass with `git push --no-verify`.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'

# Optional gitignored file for local secrets (ADMIN_PASSWORD, STRIPE_TEST_SECRET_KEY).
# See scripts/.precommit.env.example.
if [ -f scripts/.precommit.env ]; then
    # shellcheck disable=SC1091
    source scripts/.precommit.env
fi

GATEWAY="${API_URL:-http://127.0.0.1:3000}"
fail=0

skip() { echo -e "${YELLOW}⚠ SKIP: $1${NC}"; }

# --- Prerequisite: is the local stack up? ---
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "$GATEWAY/" 2>/dev/null || echo 000)
if [ "$code" = "000" ]; then
    skip "local SAM stack not reachable on $GATEWAY — start ./manage_services.sh to run the heavy suite."
    echo -e "${YELLOW}pre-push: heavy suite skipped (stack down). Push proceeding.${NC}"
    exit 0
fi

# --- 1. backend-flow: needs only the stack (uses its own __TEST__ admin). ---
echo -e "${YELLOW}▶ backend-flow-test.py${NC}"
if python3 backend-flow-test.py --base-url "$GATEWAY"; then
    echo -e "${GREEN}✓ backend-flow${NC}"
else
    echo -e "${RED}✗ backend-flow failed${NC}"; fail=1
fi

# --- 2 + 3: need the real admin password. ---
if [ -z "${ADMIN_PASSWORD:-}" ]; then
    skip "ADMIN_PASSWORD not set — storefront validator + e2e skipped (set it in scripts/.precommit.env or the environment)."
else
    echo -e "${YELLOW}▶ validate-storefront.py${NC}"
    if ADMIN_PASSWORD="$ADMIN_PASSWORD" python3 scripts/validate-storefront.py; then
        echo -e "${GREEN}✓ storefront validator${NC}"
    else
        echo -e "${RED}✗ storefront validator failed${NC}"; fail=1
    fi

    echo -e "${YELLOW}▶ e2e-storefront.py${NC}"
    if [ -z "${STRIPE_TEST_SECRET_KEY:-}" ]; then
        skip "STRIPE_TEST_SECRET_KEY not set — e2e skipped (set it in scripts/.precommit.env or the environment)."
    elif ADMIN_PASSWORD="$ADMIN_PASSWORD" STRIPE_TEST_SECRET_KEY="$STRIPE_TEST_SECRET_KEY" python3 scripts/e2e-storefront.py; then
        echo -e "${GREEN}✓ storefront e2e${NC}"
    else
        echo -e "${RED}✗ storefront e2e failed${NC}"; fail=1
    fi
fi

if [ "$fail" -ne 0 ]; then
    echo -e "${RED}pre-push checks failed — fix the above or use 'git push --no-verify' to bypass.${NC}"
    exit 1
fi
echo -e "${GREEN}pre-push checks passed.${NC}"
exit 0

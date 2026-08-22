#!/usr/bin/env bash
#
# Heavy local pre-push suite. Runs the integration tests that CI structurally
# cannot (they need a live SAM stack + MongoDB + Mailpit + Stripe sandbox).
#
# ORDERED FAST-FIRST, AND IT BAILS BETWEEN THE TWO GROUPS. That ordering is the
# whole point, so do not "tidy" it back into declaration order:
#
#   group 1 (~5 min)   validate-storefront.py   ~75s   regen + JSON-LD + Lighthouse
#                      e2e-storefront.py        ~235s  headless guest checkout + Stripe
#   -- stop here if either failed --
#   group 2 (~36 min)  backend-flow-test.py            full cross-service API suite
#
# backend-flow used to run first, so a 75-second storefront failure was only
# discovered after 36 minutes of waiting. It happened repeatedly on 2026-08-21.
# Everything must pass either way; running the cheap checks first only changes
# how quickly a failure is known, which is the difference between a 5-minute
# loop and a 40-minute one.
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

# --- 0. Safety: full DB backup BEFORE any test writes/deletes. The heavy suite
#        creates and deletes data on the (prod-shared) DB; a fresh restorable
#        snapshot first means any mistake is a mongorestore away.
#        STAYS FIRST regardless of test order: both groups write to the DB. ---
echo -e "${YELLOW}▶ backup-db.py (pre-test snapshot; skips if one <24h old exists)${NC}"
if python3 scripts/backup-db.py; then
    echo -e "${GREEN}✓ backup ok${NC}"
else
    echo -e "${RED}✗ backup failed — refusing to run destructive tests without a snapshot${NC}"
    exit 1
fi

# --- GROUP 1 (fast, ~5 min): storefront validator + e2e. Both need the real
#     admin password; e2e additionally needs the Stripe sandbox key. ---
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

# --- Early bail. Without this the reordering above buys nothing: a failed
#     75-second check would still sit through the 36-minute suite before
#     reporting. Anything already broken is reported now. ---
if [ "$fail" -ne 0 ]; then
    echo -e "${RED}pre-push checks failed in the fast group — stopping before backend-flow-test.py (36 min).${NC}"
    echo -e "${RED}Fix the above, or bypass with 'git push --no-verify'.${NC}"
    exit 1
fi

# --- GROUP 2 (slow, ~36 min): full cross-service API suite. Needs only the
#     stack (uses its own __TEST__ admin). Runs last because it is by far the
#     most expensive thing here. ---
echo -e "${YELLOW}▶ backend-flow-test.py${NC}"
if python3 backend-flow-test.py --base-url "$GATEWAY"; then
    echo -e "${GREEN}✓ backend-flow${NC}"
else
    echo -e "${RED}✗ backend-flow failed${NC}"; fail=1
fi

if [ "$fail" -ne 0 ]; then
    echo -e "${RED}pre-push checks failed — fix the above or use 'git push --no-verify' to bypass.${NC}"
    exit 1
fi
echo -e "${GREEN}pre-push checks passed.${NC}"
exit 0

#!/usr/bin/env bash
#
# One-time setup: point git at the versioned .githooks/ directory so the
# shared pre-commit / pre-push hooks activate for this clone. Run once after
# cloning (idempotent — safe to re-run).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/pre-push \
         scripts/pre-commit.sh scripts/pre-push.sh 2>/dev/null || true

echo "✓ git hooks enabled (core.hooksPath = .githooks)"
echo "  pre-commit → scripts/pre-commit.sh (fast: build/lint/vet/test)"
echo "  pre-push   → scripts/pre-push.sh   (heavy: backend-flow + storefront + e2e)"
echo
echo "Optional: create scripts/.precommit.env (gitignored) with ADMIN_PASSWORD"
echo "and STRIPE_TEST_SECRET_KEY so pre-push can run the storefront validator + e2e."

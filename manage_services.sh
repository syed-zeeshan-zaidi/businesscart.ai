#!/bin/bash

# Define service configurations
# All services now run under a single API Gateway on a single port
UNIFIED_API_PORT="3000"

build_go_service() {
  local service_dir="$1"
  local output_name="$2"
  local main_path="$3"

  echo "Building $service_dir..."
  if (cd "$service_dir" && go build -o "$output_name" "$main_path"); then
    echo "$service_dir build finished."
  else
    echo "Error: Failed to build $service_dir. Exiting."
    exit 1
  fi
}

start_services() {
  # Ensure the docker network exists
  docker network inspect businesscart-network >/dev/null 2>&1 || \
    docker network create businesscart-network

  # Mailpit — local SMTP capture for testing transactional emails.
  # SMTP on :1025 (Lambda sends here), web UI on http://localhost:8025
  # All sends are captured locally — never delivered, never spammed.
  if ! docker ps --filter name=mailpit --format '{{.Names}}' | grep -q '^mailpit$'; then
    if docker ps -a --filter name=mailpit --format '{{.Names}}' | grep -q '^mailpit$'; then
      docker start mailpit >/dev/null
    else
      # MP_SMTP_AUTH_ACCEPT_ANY + MP_SMTP_AUTH_ALLOW_INSECURE: Mailpit accepts any
      # SMTP AUTH credentials over plaintext (port 1025). Required because the Go
      # email package always sends AUTH PLAIN — without these flags Mailpit rejects
      # with "server doesn't support AUTH" and emails fail.
      docker run -d --name mailpit \
        --network businesscart-network \
        -p 1025:1025 -p 8025:8025 \
        -e MP_SMTP_AUTH_ACCEPT_ANY=true \
        -e MP_SMTP_AUTH_ALLOW_INSECURE=true \
        --restart unless-stopped \
        axllent/mailpit >/dev/null
    fi
    echo "Mailpit started — SMTP :1025, Web UI http://localhost:8025"
  else
    echo "Mailpit already running — Web UI http://localhost:8025"
  fi

  echo "Installing root NPM dependencies..."
  npm install || { echo "NPM install failed. Exiting."; exit 1; }

  echo "Clearing CDK output directory..."
  rm -rf cdk.out
  echo "Synthesizing all CDK stacks..."
  # Synthesize all stacks to ensure cross-stack references can be resolved.
  npm run cdk synth -- -c stage=local || { echo "CDK synth failed. Exiting."; exit 1; }
  echo "CDK templates synthesized successfully."

  # Build Go services before starting
  build_go_service "account-service" "bootstrap" "./cmd/server/main.go"
  build_go_service "catalog-service" "bootstrap" "./cmd/server/main.go"
  build_go_service "checkout-service" "bootstrap" "./cmd/server/main.go"

  echo "Starting unified API Gateway in a new terminal tab..."

  # We point SAM to the ApiGatewayStack template.
  # CDK automatically resolves the cross-stack Lambda references within this template.
  template_path="cdk.out/BusinessCartStack-local.template.json"

  if [ ! -f "$template_path" ]; then
    echo "Error: Template file not found at $template_path. CDK synth might have failed."
    exit 1
  fi

  echo "Preparing to start unified API on port $UNIFIED_API_PORT..."
  mkdir -p logs
  sam_cmd="sam local start-api --host 0.0.0.0 --warm-containers EAGER -t \"$template_path\" --docker-network businesscart-network --debug -l logs/unified-api.log --port \"$UNIFIED_API_PORT\" --env-vars local.env.json"

  gnome-terminal --tab --command="bash -c '$sam_cmd; exec bash'" &
  sleep 2 

  echo "Unified API Gateway launched. Check the new terminal tab for its output."
  echo "Use './manage_services.sh stop' to stop the service."
}

stop_services() {
  echo "Stopping microservices..."

  pids=$(pgrep -f "sam local start-api")
  if [ -n "$pids" ]; then
    echo "Killing SAM local processes: $pids..."
    kill $pids
  else
    echo "No SAM local processes found."
  fi

  echo "Stopping and removing any lingering SAM Docker containers..."
  docker ps -aq --filter "ancestor=public.ecr.aws/lambda" | xargs -r docker stop | xargs -r docker rm

  # Stop Mailpit but keep the container (preserves captured emails between restarts)
  if docker ps --filter name=mailpit --format '{{.Names}}' | grep -q '^mailpit$'; then
    docker stop mailpit >/dev/null
    echo "Mailpit stopped (container preserved — restart with start to resume)"
  fi

  echo "Services stopped and containers cleaned up."
}

validate_pwa() {
  echo "═══════════════════════════════════════"
  echo "  PWA Validation"
  echo "═══════════════════════════════════════"

  echo "Building web portal..."
  (cd web-portal && npm run build) || { echo "❌ Portal build failed"; return 1; }

  PASS=0
  FAIL=0

  check() {
    if [ "$2" = "true" ]; then
      echo "  ✓ $1"
      PASS=$((PASS + 1))
    else
      echo "  ✗ $1"
      FAIL=$((FAIL + 1))
    fi
  }

  # Manifest
  check "manifest.webmanifest exists" "$([ -f web-portal/dist/manifest.webmanifest ] && echo true || echo false)"
  if [ -f web-portal/dist/manifest.webmanifest ]; then
    check "manifest is valid JSON" "$(python3 -c 'import json; json.load(open("web-portal/dist/manifest.webmanifest"))' 2>/dev/null && echo true || echo false)"
    check "manifest has name" "$(grep -q '"name"' web-portal/dist/manifest.webmanifest && echo true || echo false)"
    check "manifest has icons" "$(grep -q '"icons"' web-portal/dist/manifest.webmanifest && echo true || echo false)"
    check "manifest display=standalone" "$(grep -q '"standalone"' web-portal/dist/manifest.webmanifest && echo true || echo false)"
  fi

  # Service worker
  check "sw.js exists" "$([ -f web-portal/dist/sw.js ] && echo true || echo false)"
  check "registerSW.js exists" "$([ -f web-portal/dist/registerSW.js ] && echo true || echo false)"
  if [ -f web-portal/dist/sw.js ]; then
    check "SW has no NavigationRoute" "$(! grep -q 'NavigationRoute\|createHandlerBoundToURL' web-portal/dist/sw.js && echo true || echo false)"
    check "SW has no HTML in precache" "$(! grep -q '"url":"[^"]*\.html"' web-portal/dist/sw.js && echo true || echo false)"
    check "SW has NetworkFirst for pages" "$(grep -q 'NetworkFirst' web-portal/dist/sw.js && echo true || echo false)"
    check "SW has NetworkOnly for API" "$(grep -q 'NetworkOnly' web-portal/dist/sw.js && echo true || echo false)"
  fi

  # Icons
  check "icon-192x192.png exists" "$([ -f web-portal/dist/icon-192x192.png ] && echo true || echo false)"
  check "icon-512x512.png exists" "$([ -f web-portal/dist/icon-512x512.png ] && echo true || echo false)"

  # HTML meta tags
  check "index.html has manifest link" "$(grep -q 'manifest.webmanifest' web-portal/dist/index.html && echo true || echo false)"
  check "index.html has theme-color" "$(grep -q 'theme-color' web-portal/dist/index.html && echo true || echo false)"
  check "index.html has apple-touch-icon" "$(grep -q 'apple-touch-icon' web-portal/dist/index.html && echo true || echo false)"

  # Pre-rendered pages intact
  check "sitemap.xml exists" "$([ -f web-portal/dist/sitemap.xml ] && echo true || echo false)"
  check "robots.txt exists" "$([ -f web-portal/dist/robots.txt ] && echo true || echo false)"
  check "llms.txt exists" "$([ -f web-portal/dist/llms.txt ] && echo true || echo false)"

  echo ""
  echo "  PASSED: $PASS  FAILED: $FAIL"
  echo "═══════════════════════════════════════"
  [ "$FAIL" -eq 0 ] && return 0 || return 1
}

case "$1" in
  start)
    start_services
    validate_pwa
    ;;
  stop)
    stop_services
    ;;
  restart)
    stop_services
    start_services
    validate_pwa
    ;;
  *)
    echo "Usage: $0 {start|stop|restart}"
    exit 1
    ;;
esac

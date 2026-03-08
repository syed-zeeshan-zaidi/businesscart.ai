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
  build_go_service "checkout-service" "server" "./cmd/server"

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

  echo "Services stopped and containers cleaned up."
}

case "$1" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    stop_services
    start_services
    ;; 
  *)
    echo "Usage: $0 {start|stop|restart}"
    exit 1
    ;;
esac

#!/bin/bash

# Quick script to copy D2C generated files from Lambda container to host
# It finds the most recently run container and copies from it, even if stopped.
# Usage: ./copy_d2c_files.sh [company-id]

set -e

COMPANY_ID=${1:-ui-sid-888}
TARGET_DIR="storefronts/${COMPANY_ID}"

echo "🔍 Looking for latest Lambda container to copy files for company: ${COMPANY_ID}"

# Find the container that actually has the files
echo "🔎 Searching all containers for /tmp/storefronts/${COMPANY_ID}..."
CONTAINER_ID=""
for id in $(docker ps -a --format "{{.ID}}"); do
    if docker exec "$id" test -d "/tmp/storefronts/${COMPANY_ID}" 2>/dev/null; then
        CONTAINER_ID="$id"
        break
    fi
done

if [ -z "$CONTAINER_ID" ]; then
    echo "❌ No container found containing /tmp/storefronts/${COMPANY_ID}."
    echo "   Make sure D2C generation succeeded in the logs."
    exit 1
fi

echo "✅ Found container with files: ${CONTAINER_ID}"

echo "🔎 Checking contents of /tmp/storefronts/ inside the container..."
docker exec "$CONTAINER_ID" ls -la /tmp/storefronts/ || echo "Container inspection failed. Directory might not exist or container is not in a state to exec."

echo "🔎 Checking for target directory /tmp/storefronts/${COMPANY_ID} inside the container..."
docker exec "$CONTAINER_ID" test -d "/tmp/storefronts/${COMPANY_ID}" && echo "✅ Target directory exists in container." || echo "❌ Target directory does NOT exist in container."

echo "⏳ Attempting to copy files from /tmp/storefronts/${COMPANY_ID}..."

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Docker cp works on stopped containers. Remove 2>/dev/null to see the actual error.
if docker cp "${CONTAINER_ID}:/tmp/storefronts/${COMPANY_ID}/." "$TARGET_DIR/"; then
    echo "✅ Files copied successfully to: ${TARGET_DIR}/"
    ls -lah "$TARGET_DIR/"
else
    echo "❌ Failed to copy files. Please check the error message above from 'docker cp'."
    echo "   This usually means the source path in the container was incorrect or empty."
    exit 1
fi
#!/bin/bash
# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

# Starts the opal-backend-dev server if its venv has been set up.
# If not, prints a helpful message and exits cleanly (so the main
# server still starts).

DEV_DIR="$(dirname "$0")/../../opal-backend-dev"

if [ ! -d "$DEV_DIR/.venv" ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  Dev Python backend not set up.                         ║"
  echo "║                                                         ║"
  echo "║  To enable it, run from the repo root:                  ║"
  echo "║    npm run setup:python                                 ║"
  echo "║                                                         ║"
  echo "║  Then restart dev:backend.                               ║"
  echo "║  The app will run without the dev backend for now.      ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  exit 0
fi

# Read the real upstream URL from unified-server's .env so the proxy
# forwards to the same backend the normal dev flow uses (e.g. staging).
SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  UPSTREAM=$(grep '^BACKEND_API_ENDPOINT=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '"')
fi

export PROXY_UPSTREAM_URL="${UPSTREAM:-https://appcatalyst.pa.googleapis.com}"
echo "Starting opal-backend-dev on port 8080 (upstream: $PROXY_UPSTREAM_URL)..."
SHARED_DIR="$(cd "$DEV_DIR/../opal-backend-shared/opal_backend_shared" 2>/dev/null && pwd)"
cd "$DEV_DIR" && .venv/bin/uvicorn opal_backend_dev.main:app --reload --port 8080 \
  --reload-dir opal_backend_dev \
  ${SHARED_DIR:+--reload-dir "$SHARED_DIR"}

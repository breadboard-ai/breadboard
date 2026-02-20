#!/bin/bash
# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

# Starts the opal-backend-fake server if its venv has been set up.
# If not, prints a helpful message and exits cleanly (so the main
# server still starts).

FAKE_DIR="$(dirname "$0")/../../opal-backend-fake"

if [ ! -d "$FAKE_DIR/.venv" ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  Fake Python backend not set up.                        ║"
  echo "║                                                         ║"
  echo "║  To enable it, run from the repo root:                  ║"
  echo "║    npm run setup:python                                 ║"
  echo "║                                                         ║"
  echo "║  Then restart dev:fake.                                 ║"
  echo "║  The app will run without the fake backend for now.     ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  exit 0
fi

echo "Starting opal-backend-fake on port 8000..."
cd "$FAKE_DIR" && .venv/bin/uvicorn opal_backend_fake.main:app --reload --port 8000

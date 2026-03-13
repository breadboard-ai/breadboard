#!/usr/bin/env bash
# Manual test script for session endpoints (Phase 2).
# Requires: dev server running on localhost:8080
#
# Usage: bash test-sessions.sh <access-token>
#    or: OPAL_TOKEN=... bash test-sessions.sh

set -euo pipefail

BASE="http://localhost:8080/v1beta1/sessions"
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
DIM='\033[2m'
NC='\033[0m'

TOKEN="${1:-${OPAL_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo -e "${YELLOW}Usage: bash test-sessions.sh <access-token>${NC}"
  echo -e "${YELLOW}  or:  OPAL_TOKEN=... bash test-sessions.sh${NC}"
  echo -e "${YELLOW}Grab the token from the frontend (Network tab → Authorization header).${NC}"
  exit 1
fi
AUTH_HEADER="Authorization: Bearer $TOKEN"

step() { echo -e "\n${BOLD}── $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# ── 1. Create session ──
step "POST /sessions/new — create session"
RESP=$(curl -s -X POST "$BASE/new" \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d '{"segments":[{"type":"text","text":"What is 2+2?"}]}')
echo "$RESP" | python3 -m json.tool
SESSION_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionId'])")
ok "Session ID: $SESSION_ID"

# ── 2. Poll until terminal ──
step "Waiting for session to finish..."
for i in $(seq 1 30); do
  STATUS_RESP=$(curl -s "$BASE/$SESSION_ID/status")
  STATUS=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  EVENT_COUNT=$(echo "$STATUS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['eventCount'])")
  echo -e "${DIM}  [$i] status=$STATUS events=$EVENT_COUNT${NC}"
  if [[ "$STATUS" != "running" ]]; then
    break
  fi
  sleep 1
done
ok "Final status: $STATUS ($EVENT_COUNT events)"

# ── 3. Replay all events ──
step "GET /sessions/$SESSION_ID — full event replay"
curl -s --max-time 5 "$BASE/$SESSION_ID" 2>/dev/null || true
echo ""

# ── 4. Resume (should 409 unless suspended) ──
step "POST /sessions/$SESSION_ID/resume — expect 409"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/$SESSION_ID/resume" \
  -H 'Content-Type: application/json' \
  -d '{"response":{}}')
if [ "$HTTP_CODE" = "409" ]; then
  ok "Got expected 409"
elif [ "$HTTP_CODE" = "200" ]; then
  ok "Got 200 — session was suspended"
else
  warn "Unexpected HTTP $HTTP_CODE"
fi

# ── 5. Create another session to test cancel ──
step "Cancel flow (fresh session)"
RESP2=$(curl -s -X POST "$BASE/new" \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d '{"segments":[{"type":"text","text":"Write a long essay about quantum physics"}]}')
SID2=$(echo "$RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionId'])")
echo -e "${DIM}  Created $SID2${NC}"
sleep 0.5

curl -s -X POST "$BASE/$SID2:cancel" | python3 -m json.tool
ok "Cancelled while running"

# Cancel again — should 409
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/$SID2:cancel")
if [ "$HTTP_CODE" = "409" ]; then
  ok "Second cancel → 409 (already terminal)"
else
  warn "Unexpected HTTP $HTTP_CODE"
fi

# ── 6. Not found ──
step "GET /sessions/nonexistent/status — expect 404"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/nonexistent/status")
if [ "$HTTP_CODE" = "404" ]; then
  ok "Got expected 404"
else
  warn "Unexpected HTTP $HTTP_CODE"
fi

echo -e "\n${GREEN}${BOLD}Done!${NC}"

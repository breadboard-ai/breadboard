#!/bin/bash
# Demo script for the Skill CPD (Continuing Professional Development) flow.
#
# This script resets the environment and walks through the stages:
#
# Stage 1: RESET — Clean slate, only Teacher + UI skills
#   ./demo.sh reset
#
# Stage 2: TEACH — After the agent self-teaches from 2020-2025 rules,
#   the skill should show "Knowledge current" ✅
#   (Run this step manually in the UI: "show me a wobble scorecard")
#
# Stage 3: PUBLISH — Introduce Season 15 sources (press release + journalism)
#   ./demo.sh publish
#   Refresh the Skills tab → "Knowledge stale — CPD needed" ⚠️
#
# Stage 4: REFRESH — Click "Refresh Skill" in the UI to trigger CPD
#   The Teacher re-reads all references and updates the skill.
#   Skill should now mention Duo Wobbling, Resonance, Gleam cap 9.0, etc.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/backend/skills"
REFS_DIR="$SCRIPT_DIR/backend/references/wobble-judging"
STAGING_DIR="$REFS_DIR/_staging"

case "${1:-help}" in
  reset)
    echo "🧹 Resetting demo environment..."

    # Remove all generated skills (keep teacher + ui-generator).
    for dir in "$SKILLS_DIR"/*/; do
      name=$(basename "$dir")
      if [[ "$name" != "teacher" && "$name" != "ui-generator" ]]; then
        echo "  Removing skill: $name"
        rm -rf "$dir"
      fi
    done

    # Un-publish staged references (move back to _staging).
    mkdir -p "$STAGING_DIR"
    for f in "$REFS_DIR"/icwf-season15-press-release.md \
             "$REFS_DIR"/wobble-report-season15-preview.md; do
      if [[ -f "$f" ]]; then
        mv "$f" "$STAGING_DIR/"
        echo "  Staged: $(basename "$f")"
      fi
    done

    echo "✅ Reset complete. Restart the backend and try:"
    echo "   'show me a wobble judging scorecard'"
    ;;

  publish)
    echo "📰 Publishing Season 15 references..."

    if [[ ! -d "$STAGING_DIR" ]]; then
      echo "❌ No staging directory found at $STAGING_DIR"
      exit 1
    fi

    for f in "$STAGING_DIR"/*.md; do
      if [[ -f "$f" ]]; then
        mv "$f" "$REFS_DIR/"
        echo "  Published: $(basename "$f")"
      fi
    done

    # Clean up empty staging dir.
    rmdir "$STAGING_DIR" 2>/dev/null || true

    echo "✅ Published. Restart the backend, open Skills tab → Competitive Wobbling."
    echo "   You should see: ⚠️ Knowledge stale — CPD needed"
    echo "   Click 'Refresh Skill' to trigger CPD."
    ;;

  help|*)
    echo "Usage: ./demo.sh {reset|publish}"
    echo ""
    echo "  reset   — Clean generated skills, stage Season 15 references"
    echo "  publish — Introduce Season 15 sources (triggers staleness)"
    ;;
esac

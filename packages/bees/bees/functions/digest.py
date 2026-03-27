# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Digest function group — Opie-driven digest curation.

Exposes ``digest_update`` so Opie can trigger a digest regeneration
with an editorial briefing that controls what appears on the user's
home screen.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from opal_backend.function_definition import (
    FunctionGroup,
    assemble_function_group,
    load_declarations,
)

from bees.playbook import run_playbook
from bees.ticket import list_tickets

__all__ = ["get_digest_function_group"]

logger = logging.getLogger(__name__)

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("digest", declarations_dir=_DECLARATIONS_DIR)


def _gather_ticket_context() -> str:
    """Build a summary of all active and recently completed tickets."""
    tickets = list_tickets()
    lines: list[str] = []
    for t in tickets:
        # Skip the opie and digest tickets themselves.
        if t.metadata.tags and ("opie" in t.metadata.tags or "digest" in t.metadata.tags):
            continue
        status = t.metadata.status or "unknown"
        outcome = t.metadata.outcome or ""
        title = t.metadata.title or t.id[:8]
        has_ui = bool(t.metadata.files and "bundle.js" in (t.metadata.files or []))

        # Only expose the ID if it's an actionable mini-app, otherwise the LLM will hallucinate links.
        line = f"- [{status}] **{title}**"
        if outcome:
            line += f": {outcome}"
        if has_ui:
            line += f" [Interactive Mini-App Available. To link to this app, use CTA code: `window.opalSDK.navigateTo('{t.id}')`]"
        lines.append(line)

    if not lines:
        return ""
    return "\n".join(lines)


def _get_previous_digest_ui() -> str | None:
    """Find the most recently completed digest ticket and return its App.jsx."""
    digests = [t for t in list_tickets(status="completed") if t.metadata.tags and "digest" in t.metadata.tags]
    if not digests:
        return None
    
    # Sort by ISO string created_at descending
    digests.sort(key=lambda t: t.metadata.created_at or "", reverse=True)
    
    latest = digests[0]
    app_jsx = latest.dir / "filesystem" / "App.jsx"
    app_lower = latest.dir / "filesystem" / "app.jsx"
    
    if app_jsx.exists():
        return app_jsx.read_text(encoding="utf-8", errors="replace")
    if app_lower.exists():
        return app_lower.read_text(encoding="utf-8", errors="replace")
    
    return None


def _make_handlers(on_playbook_run: Any | None = None) -> dict[str, Any]:
    """Build the handler map for the digest function group."""

    async def digest_update(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        """Trigger a digest regeneration with Opie's editorial briefing."""
        briefing = args.get("editorial_briefing", "")
        if not briefing:
            return {"error": "editorial_briefing is required"}

        if status_cb:
            status_cb("Generating digest")

        # Gather live ticket context for the UI generator.
        ticket_context = _gather_ticket_context()
        if not ticket_context:
            return {
                "status": "skipped",
                "message": "There are no tickets to feature in the digest yet. Wait until there is active work to summarize."
            }

        prev_app = _get_previous_digest_ui()
        prev_context = ""
        if prev_app:
            prev_context = (
                f"## Previous Digest UI\n"
                f"Here is the React code (`App.jsx`) from your previous digest run. "
                f"Use this as your structural baseline. Update the content to reflect the new tickets below, "
                f"but do NOT radically redesign the page. Maintain the existing layout hierarchy and CSS tokens.\n\n"
                f"```jsx\n{prev_app}\n```\n\n"
            )

        # Build the full context: ticket data + Opie's editorial direction + past UI
        full_context = (
            f"{prev_context}"
            f"## Current Tickets\n{ticket_context}\n\n"
            f"## Opie's Editorial Briefing\n{briefing}"
        )

        try:
            tickets = run_playbook("update-digest", context=full_context)
        except FileNotFoundError:
            return {"error": "update-digest playbook not found"}
        except Exception as e:
            logger.exception("digest_update failed")
            return {"error": str(e)}

        if status_cb:
            status_cb(None, None)

        if on_playbook_run:
            on_playbook_run(tickets)

        ticket_id = tickets[0].id if tickets else "(none)"
        return {
            "status": "queued",
            "ticket_id": ticket_id,
        }

    return {
        "digest_update": digest_update,
    }


def get_digest_function_group(
    on_playbook_run: Any | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with digest_update."""
    handlers = _make_handlers(on_playbook_run)
    return assemble_function_group(_LOADED, handlers)

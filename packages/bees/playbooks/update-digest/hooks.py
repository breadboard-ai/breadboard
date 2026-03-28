# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Lifecycle hooks for the update-digest playbook.

Gathers system state (ticket summaries, previous digest UI) and
enriches the caller-supplied editorial briefing into the full context
needed by the digest generator.
"""

from __future__ import annotations

import logging
from typing import Any

from bees.ticket import Ticket, list_tickets

logger = logging.getLogger(__name__)


def on_prepare(context: str | None) -> str | None:
    """Enrich the editorial briefing with ticket data and previous UI.

    Returns the full context string, or None if there are no tickets
    to feature (which aborts the playbook run).
    """
    ticket_context = _gather_ticket_context()
    if not ticket_context:
        return None  # Nothing to feature — abort.

    prev_ui = _get_previous_digest_ui()
    prev_section = ""
    if prev_ui:
        prev_section = (
            "## Previous Digest UI (Your Starting Point)\n"
            "Here is the EXACT React code (`App.jsx`) from your previous digest.\n"
            "**You MUST use this as your starting point.** Edit the content, add/remove sections, "
            "and update copy to reflect the new tickets below — but:\n"
            "- Do NOT change the color scheme. The app uses `var(--cg-color-*)` CSS tokens for a dark theme. Keep it.\n"
            "- Do NOT radically redesign the layout structure. Evolve it, don't replace it.\n"
            "- Do NOT switch between light and dark themes.\n\n"
            f"```jsx\n{prev_ui}\n```\n\n"
        )

    briefing = context or ""
    return (
        f"{prev_section}"
        f"## Current Tickets\n{ticket_context}\n\n"
        f"## Editorial Briefing\n{briefing}"
    )


# ---------------------------------------------------------------------------
# Context gathering
# ---------------------------------------------------------------------------


def _gather_ticket_context() -> str:
    """Build a summary of all user-visible tickets."""
    tickets = list_tickets()
    lines: list[str] = []
    for t in tickets:
        # Skip infrastructure tickets (opie orchestrator, digest renders).
        if t.metadata.tags and ("opie" in t.metadata.tags or "digest" in t.metadata.tags):
            continue
        status = t.metadata.status or "unknown"
        outcome = t.metadata.outcome or ""
        title = t.metadata.title or t.id[:8]
        has_ui = bool(t.metadata.files and "bundle.js" in (t.metadata.files or []))

        line = f"- [{status}] **{title}**"
        if outcome:
            line += f": {outcome}"
        if has_ui:
            line += (
                f" [Interactive Mini-App Available. To link to this app, "
                f"use CTA code: `window.opalSDK.navigateTo('{t.id}')`]"
            )
        lines.append(line)

    if not lines:
        return ""
    return "\n".join(lines)


def _get_previous_digest_ui() -> str | None:
    """Find the most recently completed digest ticket and return its App.jsx."""
    digests = [
        t for t in list_tickets(status="completed")
        if t.metadata.tags and "digest" in t.metadata.tags
    ]
    if not digests:
        return None

    digests.sort(key=lambda t: t.metadata.created_at or "", reverse=True)
    latest = digests[0]

    app_jsx = latest.dir / "filesystem" / "App.jsx"
    app_lower = latest.dir / "filesystem" / "app.jsx"

    if app_jsx.exists():
        return app_jsx.read_text(encoding="utf-8", errors="replace")
    if app_lower.exists():
        return app_lower.read_text(encoding="utf-8", errors="replace")

    return None

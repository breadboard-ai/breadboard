# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
ticket:respond CLI — interactively respond to suspended tickets.

Scans for tickets with status=suspended and assignee=user,
displays the agent's question, and collects the user's response.

Usage::

    npm run ticket:respond -w packages/bees
"""

from __future__ import annotations

import json
import sys
from typing import Any

from bees import Task, TaskStore
from app.config import load_hive_dir

task_store = TaskStore(load_hive_dir())


def _format_prompt(suspend_event: dict[str, Any] | None) -> str:
    """Extract a human-readable prompt from a suspend event."""
    if not suspend_event:
        return "(no prompt available)"

    # Try each suspend type to find the prompt.
    for key in ("waitForInput", "waitForChoice"):
        if key not in suspend_event:
            continue
        payload = suspend_event[key]
        prompt = payload.get("prompt", {})
        parts = prompt.get("parts", [])
        texts = [p.get("text", "") for p in parts if "text" in p]
        if texts:
            return "\n".join(texts)

    return "(no prompt available)"


def _format_choices(suspend_event: dict[str, Any] | None) -> list[dict] | None:
    """Extract choices from a WaitForChoiceEvent, if present."""
    if not suspend_event or "waitForChoice" not in suspend_event:
        return None
    payload = suspend_event["waitForChoice"]
    return payload.get("choices", [])


def _respond_to_ticket(ticket: Task) -> bool:
    """Prompt the user and save their response. Returns True if responded."""
    label = ticket.id[:8]
    prompt_text = _format_prompt(ticket.metadata.suspend_event)
    choices = _format_choices(ticket.metadata.suspend_event)

    print(f"\n{'─' * 60}")
    print(f"Ticket {label}:")
    print(f"  Objective: {ticket.objective!r}")
    print(f"  Agent asks: {prompt_text}")

    if choices:
        print("  Choices:")
        for i, choice in enumerate(choices):
            content = choice.get("content", {})
            parts = content.get("parts", [])
            text = " ".join(p.get("text", "") for p in parts if "text" in p)
            print(f"    [{i + 1}] {text or choice.get('id', '?')}")

    print()
    try:
        answer = input("  Your response (or 'skip'): ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\n  Skipped.", file=sys.stderr)
        return False

    if not answer or answer.lower() == "skip":
        return False

    # Build the response payload.
    if choices:
        # Try to interpret as a choice number.
        try:
            idx = int(answer) - 1
            if 0 <= idx < len(choices):
                response = {"selectedIds": [choices[idx]["id"]]}
            else:
                response = {"text": answer}
        except ValueError:
            response = {"text": answer}
    else:
        response = {"text": answer}

    # Write response and update assignee via store.
    task_store.respond(ticket.id, response)

    print(f"  ✅ Response saved. Run 'npm run ticket:drain' to resume.")
    return True


def main() -> None:
    """CLI entry point for ticket:respond."""
    suspended = [
        t for t in task_store.query_all(status="suspended")
        if t.metadata.assignee == "user"
    ]

    if not suspended:
        print("No tickets waiting for your response.", file=sys.stderr)
        return

    print(
        f"Found {len(suspended)} ticket(s) waiting for your response.",
        file=sys.stderr,
    )

    responded = 0
    for ticket in suspended:
        if _respond_to_ticket(ticket):
            responded += 1

    print(f"\n{'─' * 60}")
    print(f"Responded to {responded}/{len(suspended)} ticket(s).")
    if responded:
        print("Run 'npm run ticket:drain' to resume them.")


if __name__ == "__main__":
    main()

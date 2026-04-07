# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Context update formatting — text part templates for agent conversations.

Context updates are system notifications delivered to agents as specially-
formatted text parts in ``role: "user"`` turns.  They are decoupled from
function responses — any part of the system can produce them and they can
be injected at any conversation boundary.

Format::

    <context_update>Human-readable notification text</context_update>

Formatting functions normalize different update sources (dicts, strings)
into the canonical text representation.
"""

from __future__ import annotations

import json
from typing import Any

__all__ = [
    "format_context_update_part",
    "format_task_completed",
    "format_raw_update",
]

# The XML tag used to wrap context update text in conversation parts.
CONTEXT_UPDATE_TAG = "context_update"


def format_context_update_part(text: str) -> dict[str, Any]:
    """Wrap a text string as a context update conversation part.

    Returns a Gemini-compatible part dict::

        {"text": "<context_update>...text...</context_update>"}
    """
    return {"text": f"<{CONTEXT_UPDATE_TAG}>{text}</{CONTEXT_UPDATE_TAG}>"}


def format_task_completed(task_id: str, outcome: str) -> str:
    """Format a child-task completion notification.

    Produces a human-readable string from the structured
    ``{"task_id": ..., "outcome": ...}`` dict that
    ``Scheduler._deliver_context_update`` sends.
    """
    short_id = task_id[:8] if len(task_id) > 8 else task_id
    return f"Task {short_id} completed: {outcome}"


def format_raw_update(update: Any) -> str:
    """Normalize an update value to text.

    - Strings pass through unchanged.
    - Dicts with ``task_id`` and ``outcome`` use :func:`format_task_completed`.
    - Other dicts are JSON-serialized.
    """
    if isinstance(update, str):
        return update
    if isinstance(update, dict):
        task_id = update.get("task_id")
        outcome = update.get("outcome")
        if task_id and outcome:
            return format_task_completed(task_id, outcome)
        return json.dumps(update, ensure_ascii=False)
    return str(update)


def updates_to_context_parts(
    updates: list[Any],
) -> list[dict[str, Any]]:
    """Convert a list of raw update values to context update parts.

    Each update is normalized to text via :func:`format_raw_update`,
    then wrapped as a context update part via :func:`format_context_update_part`.
    """
    return [
        format_context_update_part(format_raw_update(u))
        for u in updates
    ]

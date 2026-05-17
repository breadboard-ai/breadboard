# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Segment resolution — pure data transforms for objective references.

Resolves ``{{…}}`` references in task objectives by substituting
dependency outcomes and system variables.  Used by the task runner
to build the structured input for a session.
"""

from __future__ import annotations

from typing import Any

from bees.agent import Agent
from bees.task_store import _DEP_PATTERN
from bees.unified_agent_store import UnifiedAgentStore

__all__ = ["resolve_segments"]


def resolve_segments(agent: Agent, store: UnifiedAgentStore) -> list[dict[str, Any]]:
    """Build segments from an agent's objective, resolving ``{{…}}`` references.

    References are resolved by namespace:

    - ``{{system.context}}`` — replaced with the agent's context string.
    - ``{{system.ticket_id}}`` — replaced with the agent's own ID.
    - ``{{ticket-id}}`` — replaced with the dependency's outcome as an
      ``input`` segment carrying LLMContent.

    Plain text around references becomes text segments.
    """
    objective = agent.objective
    deps = agent.metadata.depends_on or []
    context = agent.metadata.context or ""

    # Build a lookup from dep ID to resolved outcome.
    dep_outcomes: dict[str, dict[str, Any]] = {}
    for dep_id in deps:
        dep = store.get(dep_id)
        if dep and dep.metadata.outcome_content:
            dep_outcomes[dep_id] = dep.metadata.outcome_content

    # Split objective on {{...}} boundaries.
    parts = _DEP_PATTERN.split(objective)
    segments: list[dict[str, Any]] = []

    for i, part in enumerate(parts):
        if i % 2 == 0:
            # Text between refs.
            if part:
                segments.append({"type": "text", "text": part})
        else:
            # Resolve by namespace.
            if part == "system.context":
                if context:
                    segments.append({"type": "text", "text": context})
            elif part == "system.ticket_id":
                segments.append({"type": "text", "text": agent.id})
            else:
                # Dependency ref — resolve to input segment.
                resolved_id = _find_dep_id(part, deps)
                if resolved_id and resolved_id in dep_outcomes:
                    segments.append({
                        "type": "input",
                        "title": f"ticket-{resolved_id[:8]}",
                        "content": dep_outcomes[resolved_id],
                    })
                else:
                    # Fallback: just include as text.
                    segments.append({
                        "type": "text",
                        "text": f"(output of ticket {part})",
                    })

    return segments


def _find_dep_id(ref: str, dep_ids: list[str]) -> str | None:
    """Match a ref (prefix or full UUID) against resolved dep IDs."""
    for dep_id in dep_ids:
        if dep_id == ref or dep_id.startswith(ref):
            return dep_id
    return None

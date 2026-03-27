# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Playbook loader and runner.

A playbook is a YAML file that declares a DAG of ticket steps.
Running a playbook creates tickets in topological order so that
each ticket's ``{{step-name}}`` references resolve to already-created
ticket IDs.
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any

import yaml

from bees.ticket import Ticket, _DEP_PATTERN, create_ticket

PLAYBOOKS_DIR = Path(__file__).resolve().parent.parent / "playbooks"

# Step properties that map directly to ticket metadata fields.
_STEP_KEYS = {"title", "objective", "functions", "skills", "tags", "assignee", "model"}


def load_playbook(name: str) -> dict[str, Any]:
    """Load a playbook YAML by name.

    Looks for ``playbooks/{name}.yaml`` relative to the package root.
    """
    path = PLAYBOOKS_DIR / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Playbook not found: {path}")

    with open(path) as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict) or "steps" not in data:
        raise ValueError(f"Playbook {name} must contain a 'steps' mapping.")

    return data


def topological_sort(steps: dict[str, dict]) -> list[str]:
    """Return step names in dependency order.

    Dependencies are inferred from ``{{step-name}}`` references in
    each step's objective. Raises ``ValueError`` on cycles.
    """
    step_names = set(steps.keys())

    # Build adjacency: step -> set of steps it depends on.
    deps: dict[str, set[str]] = {}
    for name, step in steps.items():
        objective = step.get("objective", "")
        refs = set(_DEP_PATTERN.findall(objective))
        # Only keep refs that point to other steps in this playbook.
        deps[name] = refs & step_names

    # Kahn's algorithm.
    in_degree = {name: len(deps[name]) for name in step_names}
    queue = [n for n in step_names if in_degree[n] == 0]
    # Sort the initial queue for deterministic ordering.
    queue.sort()
    order: list[str] = []

    while queue:
        node = queue.pop(0)
        order.append(node)
        for name in sorted(step_names):
            if node in deps[name]:
                deps[name].discard(node)
                in_degree[name] -= 1
                if in_degree[name] == 0:
                    queue.append(name)

    if len(order) != len(step_names):
        remaining = step_names - set(order)
        raise ValueError(
            f"Cycle detected in playbook steps: {remaining}"
        )

    return order


def run_playbook(name: str) -> list[Ticket]:
    """Create tickets for each step of a playbook.

    Steps are created in topological order so that ``{{step-name}}``
    references in objectives are replaced with the concrete ticket ID
    of the already-created step.

    Returns the list of created tickets.
    """
    data = load_playbook(name)
    steps = data["steps"]
    playbook_id = data.get("name", name)
    playbook_run_id = str(uuid.uuid4())

    order = topological_sort(steps)

    # Map from step name -> created ticket ID.
    step_ticket_ids: dict[str, str] = {}
    created_tickets: list[Ticket] = []

    for step_name in order:
        step = steps[step_name]
        objective = step.get("objective", "")

        # Replace {{step-name}} with {{ticket-id}} for already-created steps.
        for ref_name, ticket_id in step_ticket_ids.items():
            objective = objective.replace(f"{{{{{ref_name}}}}}", f"{{{{{ticket_id}}}}}")

        ticket = create_ticket(
            objective,
            title=step.get("title"),
            functions=step.get("functions"),
            skills=step.get("skills"),
            tags=step.get("tags"),
            assignee=step.get("assignee"),
            model=step.get("model"),
            playbook_id=playbook_id,
            playbook_run_id=playbook_run_id,
        )

        step_ticket_ids[step_name] = ticket.id
        created_tickets.append(ticket)

    return created_tickets

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Playbook loader and runner.

A playbook is a directory under ``playbooks/{name}/`` containing:
- ``PLAYBOOK.yaml`` — step declarations (a DAG of ticket steps)
- ``hooks.py`` (optional) — Python lifecycle hooks

Running a playbook creates tickets in topological order so that
each ticket's ``{{step-name}}`` references resolve to already-created
ticket IDs.
"""

from __future__ import annotations

import importlib.util
import logging
import re
import uuid
from pathlib import Path
from types import ModuleType
from typing import Any

import yaml

from bees.ticket import Ticket, _DEP_PATTERN, create_ticket

logger = logging.getLogger(__name__)

PLAYBOOKS_DIR = Path(__file__).resolve().parent.parent / "playbooks"

# Step properties that map directly to ticket metadata fields.
_STEP_KEYS = {"title", "objective", "functions", "skills", "tags", "assignee", "model", "watch_events"}


class PlaybookAborted(Exception):
    """Raised when a playbook's on_run_playbook hook declines to run."""


# ---------------------------------------------------------------------------
# Discovery and loading
# ---------------------------------------------------------------------------


def list_playbooks() -> list[str]:
    """Return the names of all available playbooks.

    Scans for directories under ``PLAYBOOKS_DIR`` that contain a
    ``PLAYBOOK.yaml`` file.
    """
    if not PLAYBOOKS_DIR.is_dir():
        return []
    return sorted(
        d.name
        for d in PLAYBOOKS_DIR.iterdir()
        if d.is_dir() and (d / "PLAYBOOK.yaml").exists()
    )


def load_playbook(name: str) -> dict[str, Any]:
    """Load a playbook YAML by name.

    Looks for ``playbooks/{name}/PLAYBOOK.yaml`` relative to the
    package root.
    """
    path = PLAYBOOKS_DIR / name / "PLAYBOOK.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Playbook not found: {path}")

    with open(path) as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict) or "steps" not in data:
        raise ValueError(f"Playbook {name} must contain a 'steps' mapping.")

    return data


def _load_hooks(name: str) -> ModuleType | None:
    """Import a playbook's hooks.py if it exists."""
    hooks_path = PLAYBOOKS_DIR / name / "hooks.py"
    if not hooks_path.exists():
        return None

    spec = importlib.util.spec_from_file_location(
        f"playbook_hooks.{name}", hooks_path,
    )
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _normalize_step_ref(ref: str, step_names: set[str]) -> str | None:
    """Extract the step name from a template ref, or None if not a step ref.

    Recognises both ``{{step-name}}`` (shorthand) and
    ``{{playbook.step-name}}`` (explicit).  Returns ``None`` for
    system parameters (``system.*``) or unknown refs.
    """
    if ref.startswith("system."):
        return None
    bare = ref.removeprefix("playbook.")
    return bare if bare in step_names else None


def topological_sort(steps: dict[str, dict]) -> list[str]:
    """Return step names in dependency order.

    Dependencies are inferred from ``{{step-name}}`` (or
    ``{{playbook.step-name}}``) references in each step's objective.
    System parameters like ``{{system.context}}`` are ignored.
    Raises ``ValueError`` on cycles.
    """
    step_names = set(steps.keys())

    # Build adjacency: step -> set of steps it depends on.
    deps: dict[str, set[str]] = {}
    for name, step in steps.items():
        objective = step.get("objective", "")
        raw_refs = _DEP_PATTERN.findall(objective)
        resolved = {
            _normalize_step_ref(r, step_names)
            for r in raw_refs
        }
        deps[name] = resolved - {None}

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


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_playbook(
    name: str,
    *,
    context: str | None = None,
    parent_run_id: str | None = None,
) -> list[Ticket]:
    """Create tickets for each step of a playbook.

    Steps are created in topological order so that ``{{step-name}}``
    references in objectives are replaced with the concrete ticket ID
    of the already-created step.

    If ``parent_run_id`` is provided, all created tickets will share
    the parent run's workspace directory instead of getting their own.

    If the playbook has a ``hooks.py`` with an ``on_run_playbook`` function,
    it is called before ticket creation. The hook receives the
    caller-supplied context and may return enriched context, or ``None``
    to abort the run (raises ``PlaybookAborted``).

    Returns the list of created tickets.
    """
    data = load_playbook(name)

    # Run on_run_playbook hook if present.
    hooks = _load_hooks(name)
    if hooks and hasattr(hooks, "on_run_playbook"):
        context = hooks.on_run_playbook(context)
        if context is None:
            raise PlaybookAborted(
                f"Playbook '{name}' declined to run (on_run_playbook returned None)."
            )

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

        # Replace {{step-name}} and {{playbook.step-name}} with {{ticket-id}}.
        for ref_name, ticket_id in step_ticket_ids.items():
            objective = objective.replace(f"{{{{{ref_name}}}}}", f"{{{{{ticket_id}}}}}")
            objective = objective.replace(f"{{{{playbook.{ref_name}}}}}", f"{{{{{ticket_id}}}}}")

        # Only attach context to root tickets (those with no step deps).
        raw_refs = _DEP_PATTERN.findall(step.get("objective", ""))
        step_refs = {
            _normalize_step_ref(r, set(steps.keys()))
            for r in raw_refs
        } - {None}
        is_root = len(step_refs) == 0

        ticket = create_ticket(
            objective,
            title=step.get("title"),
            functions=step.get("functions"),
            skills=step.get("skills"),
            tags=step.get("tags"),
            assignee=step.get("assignee"),
            model=step.get("model"),
            watch_events=step.get("watch_events"),
            playbook_id=playbook_id,
            playbook_run_id=playbook_run_id,
            parent_run_id=parent_run_id,
            context=context if is_root else None,
        )

        step_ticket_ids[step_name] = ticket.id
        created_tickets.append(ticket)

    return created_tickets


def run_startup_hooks(tickets: list[Ticket]) -> list[Ticket]:
    """Run ``on_startup`` hooks for all playbooks.

    Iterates every playbook that defines an ``on_startup(tickets)`` hook
    in its ``hooks.py``.  Each hook receives the current ticket list and
    returns any tickets it created.  All created tickets are collected
    and returned so the caller can broadcast them.
    """
    created: list[Ticket] = []
    for name in list_playbooks():
        hooks = _load_hooks(name)
        if hooks and hasattr(hooks, "on_startup"):
            try:
                new_tickets = hooks.on_startup(tickets)
                created.extend(new_tickets)
                if new_tickets:
                    logger.info(
                        "Startup hook for '%s' created %d ticket(s)",
                        name, len(new_tickets),
                    )
            except Exception as exc:
                logger.warning("Startup hook for '%s' failed: %s", name, exc)
    return created


def run_ticket_done_hooks(ticket: Ticket) -> None:
    """Run ``on_ticket_done`` for the playbook that owns this ticket.

    Looks up the ticket's ``playbook_id`` and, if the corresponding
    playbook defines an ``on_ticket_done(ticket)`` hook, calls it.
    Tickets not created by a playbook are silently skipped.
    """
    playbook_id = ticket.metadata.playbook_id
    if not playbook_id:
        return

    hooks = _load_hooks(playbook_id)
    if hooks and hasattr(hooks, "on_ticket_done"):
        try:
            hooks.on_ticket_done(ticket)
        except Exception as exc:
            logger.warning(
                "on_ticket_done hook for '%s' failed: %s", playbook_id, exc,
            )


def run_event_hooks(
    signal_type: str, payload: str, ticket: Ticket,
) -> str | None:
    """Run ``on_event`` for the playbook that owns this ticket.

    Called by the scheduler before delivering a coordination signal.
    The hook can inspect the signal, apply side effects (e.g., rename
    the ticket), and decide whether to pass the signal through or eat it.

    Returns the (possibly transformed) payload to deliver, or ``None``
    to suppress delivery (eat the signal).

    Fail-open: if the hook raises, the signal is delivered as-is.
    """
    playbook_id = ticket.metadata.playbook_id
    if not playbook_id:
        return payload

    hooks = _load_hooks(playbook_id)
    if not hooks or not hasattr(hooks, "on_event"):
        return payload

    try:
        return hooks.on_event(signal_type, payload, ticket)
    except Exception as exc:
        logger.warning(
            "on_event hook for '%s' failed: %s", playbook_id, exc,
        )
        return payload


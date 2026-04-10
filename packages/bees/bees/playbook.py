# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Template loader and runner.

A template is an entry in ``hive/config/TEMPLATES.yaml`` that defines a
single agent ticket: an objective, tools, skills, and metadata.

Running a template creates one ticket and returns it.
"""

from __future__ import annotations

import importlib.util
import logging
import uuid
from pathlib import Path
from types import ModuleType
from typing import Any

import yaml

from bees.config import HIVE_DIR
from bees.ticket import Ticket, create_ticket

logger = logging.getLogger(__name__)

CONFIG_DIR = HIVE_DIR / "config"
TEMPLATES_PATH = CONFIG_DIR / "TEMPLATES.yaml"
HOOKS_DIR = CONFIG_DIR / "hooks"


class PlaybookAborted(Exception):
    """Raised when a template's on_run_playbook hook declines to run."""


# ---------------------------------------------------------------------------
# Discovery and loading
# ---------------------------------------------------------------------------


def _load_templates() -> list[dict[str, Any]]:
    """Parse TEMPLATES.yaml and return the list of template dicts."""
    if not TEMPLATES_PATH.exists():
        return []
    with open(TEMPLATES_PATH) as f:
        data = yaml.safe_load(f)
    if not isinstance(data, list):
        logger.warning("TEMPLATES.yaml must be a list; got %s", type(data).__name__)
        return []
    return data


def list_playbooks() -> list[str]:
    """Return the names of all available templates."""
    return [t["name"] for t in _load_templates() if "name" in t]


def load_playbook(name: str) -> dict[str, Any]:
    """Load a template by name.

    Returns the template dict directly (flat — no ``steps`` wrapper).
    """
    for t in _load_templates():
        if t.get("name") == name:
            return t
    raise FileNotFoundError(f"Template not found: {name}")




def _load_hooks(name: str) -> ModuleType | None:
    """Import a template's hooks module if it exists.

    Looks for ``hive/config/hooks/{name}.py``.
    """
    hooks_path = HOOKS_DIR / f"{name}.py"
    if not hooks_path.exists():
        return None

    spec = importlib.util.spec_from_file_location(
        f"template_hooks.{name}", hooks_path,
    )
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_playbook(
    name: str,
    *,
    context: str | None = None,
    parent_ticket_id: str | None = None,
    slug: str | None = None,
) -> Ticket:
    """Create a ticket from a template.

    If ``parent_ticket_id`` is provided, the created ticket shares the
    parent ticket's workspace directory instead of getting its own.

    If the template has a hooks module with an ``on_run_playbook`` function,
    it is called before ticket creation. The hook receives the
    caller-supplied context and may return enriched context, or ``None``
    to abort the run (raises ``PlaybookAborted``).

    Returns the created ticket.
    """
    data = load_playbook(name)

    # Run on_run_playbook hook if present.
    hooks = _load_hooks(name)
    if hooks and hasattr(hooks, "on_run_playbook"):
        context = hooks.on_run_playbook(context)
        if context is None:
            raise PlaybookAborted(
                f"Template '{name}' declined to run (on_run_playbook returned None)."
            )

    playbook_id = data.get("name", name)
    playbook_run_id = str(uuid.uuid4())

    ticket = create_ticket(
        data.get("objective", ""),
        title=data.get("title"),
        functions=data.get("functions"),
        skills=data.get("skills"),
        tags=data.get("tags"),
        assignee=data.get("assignee"),
        model=data.get("model"),
        watch_events=data.get("watch_events"),
        tasks=data.get("tasks"),
        playbook_id=playbook_id,
        playbook_run_id=playbook_run_id,
        parent_ticket_id=parent_ticket_id,
        context=context,
        slug=slug,
    )

    return ticket


def run_startup_hooks(tickets: list[Ticket]) -> list[Ticket]:
    """Run ``on_startup`` hooks for all templates.

    Iterates every template that defines an ``on_startup(tickets)`` hook
    in its hooks module.  Each hook receives the current ticket list and
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
    """Run ``on_ticket_done`` for the template that owns this ticket.

    Looks up the ticket's ``playbook_id`` and, if the corresponding
    template defines an ``on_ticket_done(ticket)`` hook, calls it.
    Tickets not created by a template are silently skipped.
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
    """Run ``on_event`` for the template that owns this ticket.

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

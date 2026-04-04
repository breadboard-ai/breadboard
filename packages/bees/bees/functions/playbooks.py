# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Playbooks function group — list and run playbooks.

Exposes ``playbooks_list`` and ``playbooks_run_playbook`` so the agent
can discover available playbooks and launch them as ticket workflows.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable

from opal_backend.function_definition import (
    FunctionGroup,
    assemble_function_group,
    load_declarations,
)

from bees.playbook import PlaybookAborted, list_playbooks, load_playbook, run_playbook
from bees.ticket import Ticket, create_ticket

__all__ = ["get_playbooks_function_group"]

logger = logging.getLogger(__name__)

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("playbooks", declarations_dir=_DECLARATIONS_DIR)


def _make_handlers(
    on_playbook_run: Any | None = None,
    on_coordination_emit: Callable[[Ticket], None] | None = None,
    workspace_root_id: str | None = None,
) -> dict[str, Any]:
    """Build the handler map for the playbooks function group."""

    async def playbooks_list(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        """List all available playbooks."""
        if status_cb:
            status_cb("Listing playbooks")

        playbooks: list[dict[str, str]] = []
        try:
            for name in list_playbooks():
                try:
                    data = load_playbook(name)
                    if data.get("hidden"):
                        continue
                    steps = data.get("steps", {})
                    if any(
                        "testing" in (s.get("tags") or [])
                        for s in steps.values()
                    ):
                        continue
                    playbooks.append({
                        "name": data.get("name", name),
                        "title": data.get("title", name),
                        "description": data.get("description", ""),
                    })
                except (ValueError, FileNotFoundError):
                    logger.warning("playbooks: skipping invalid %s", name)
        except Exception as e:
            logger.exception("playbooks_list failed")
            return {"error": str(e)}

        if status_cb:
            status_cb(None, None)
        return {"playbooks": playbooks}

    async def playbooks_run_playbook(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        """Run a playbook by name."""
        name = args.get("name", "")
        if not name:
            return {"error": "name is required"}

        context = args.get("context")
        share_workspace = args.get("share_workspace", False)

        # When share_workspace is requested, child tickets use the
        # caller's workspace root as their parent_ticket_id.
        parent_ticket_id = workspace_root_id if share_workspace else None

        if status_cb:
            status_cb(f"Running playbook: {name}")

        try:
            tickets = run_playbook(
                name,
                context=context,
                parent_ticket_id=parent_ticket_id,
            )
        except PlaybookAborted as e:
            return {"status": "skipped", "message": str(e)}
        except FileNotFoundError:
            return {"error": f"Playbook not found: {name}"}
        except ValueError as e:
            return {"error": str(e)}
        except Exception as e:
            logger.exception("playbooks_run_playbook failed")
            return {"error": str(e)}

        if status_cb:
            status_cb(None, None)

        if on_playbook_run:
            on_playbook_run(tickets)

        # Emit starting events as run-scoped coordination tickets.
        run_id = tickets[0].metadata.playbook_run_id if tickets else None
        for event in args.get("events", []):
            signal_type = event.get("type", "")
            if not signal_type:
                continue
            coord = create_ticket(
                "",
                kind="coordination",
                signal_type=signal_type,
                context=event.get("payload", ""),
                playbook_run_id=run_id,
            )
            if on_coordination_emit:
                on_coordination_emit(coord)

        return {
            "playbook": name,
            "tickets_created": len(tickets),
            "tickets": [
                {
                    "id": t.id,
                    "title": t.metadata.title or "(untitled)",
                }
                for t in tickets
            ],
        }

    return {
        "playbooks_list": playbooks_list,
        "playbooks_run_playbook": playbooks_run_playbook,
    }


def get_playbooks_function_group(
    on_playbook_run: Any | None = None,
    on_coordination_emit: Callable[[Ticket], None] | None = None,
    workspace_root_id: str | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with playbooks_list and playbooks_run_playbook."""
    handlers = _make_handlers(
        on_playbook_run,
        on_coordination_emit,
        workspace_root_id=workspace_root_id,
    )
    return assemble_function_group(_LOADED, handlers)

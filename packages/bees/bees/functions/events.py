# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Events function group — inter-agent communication.

Exposes ``events_send_to_parent`` (direct parent delivery) and
``events_broadcast`` (pub/sub via watch_events) so agents can
communicate mid-session.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable

from bees.subagent_scope import SubagentScope

from opal_backend.function_definition import (
    FunctionGroup,
    SessionHooks,
    assemble_function_group,
    load_declarations,
    FunctionGroupFactory,
)

from bees.ticket import Ticket

__all__ = ["get_events_function_group_factory"]

logger = logging.getLogger(__name__)

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("events", declarations_dir=_DECLARATIONS_DIR)


def _make_handlers(
    *,
    on_events_broadcast: Callable[[Ticket], None] | None = None,
    deliver_to_parent: Callable[[dict[str, Any]], None] | None = None,
    ticket_id: str | None = None,
    scope: SubagentScope | None = None,
    scheduler: Any | None = None,
) -> dict[str, Any]:
    """Build the handler map for the events function group."""

    async def events_send_to_parent(
        args: dict[str, Any], status_cb: Any,
    ) -> dict[str, Any]:
        """Send a typed event directly to the parent agent."""
        event_type = args.get("type", "")
        message = args.get("message", "")

        if not event_type:
            return {"error": "type is required"}

        if not deliver_to_parent:
            return {"error": "No parent agent — this agent was not created as a task"}

        if status_cb:
            status_cb(f"Sending to parent: {event_type}")

        try:
            update = {
                "type": event_type,
                "message": message,
                "from_ticket_id": ticket_id,
                "from_slug": scope.slug_path if scope else None,
            }
            deliver_to_parent(update)
        except Exception as e:
            logger.exception("events_send_to_parent failed")
            return {"error": str(e)}

        if status_cb:
            status_cb(None, None)

        return {
            "type": event_type,
            "delivered": True,
        }

    async def events_broadcast(
        args: dict[str, Any], status_cb: Any,
    ) -> dict[str, Any]:
        """Broadcast a typed event to all subscribers."""
        event_type = args.get("type", "")
        message = args.get("message", "")

        if not event_type:
            return {"error": "type is required"}

        if status_cb:
            status_cb(f"Broadcasting event: {event_type}")

        try:
            if not scheduler:
                return {"error": "Scheduler not available"}
            ticket = scheduler.store.create(
                "",  # No objective — event tickets carry context, not work.
                kind="coordination",
                signal_type=event_type,
                context=message,
            )
        except Exception as e:
            logger.exception("events_broadcast failed")
            return {"error": str(e)}

        if status_cb:
            status_cb(None, None)

        if on_events_broadcast:
            on_events_broadcast(ticket)

        return {
            "ticket_id": ticket.id,
            "type": event_type,
            "broadcast": True,
        }

    return {
        "events_send_to_parent": events_send_to_parent,
        "events_broadcast": events_broadcast,
    }


def get_events_function_group_factory(
    *,
    on_events_broadcast: Callable[[Ticket], None] | None = None,
    deliver_to_parent: Callable[[dict[str, Any]], None] | None = None,
    ticket_id: str | None = None,
    scope: SubagentScope | None = None,
    scheduler: Any | None = None,
) -> FunctionGroupFactory:
    """Build a FunctionGroupFactory for events."""
    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(
            on_events_broadcast=on_events_broadcast,
            deliver_to_parent=deliver_to_parent,
            ticket_id=ticket_id,
            scope=scope,
            scheduler=scheduler,
        )
        return assemble_function_group(_LOADED, handlers)
    return factory

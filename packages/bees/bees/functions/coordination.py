# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Coordination function group — inter-agent signal emission.

Exposes ``coordination_emit`` so an agent can emit a typed signal
mid-session. The scheduler routes the signal to all tickets with
matching ``watch_events`` entries.
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

from bees.ticket import Ticket, create_ticket

__all__ = ["get_coordination_function_group"]

logger = logging.getLogger(__name__)

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("coordination", declarations_dir=_DECLARATIONS_DIR)


def _make_handlers(
    on_coordination_emit: Callable[[Ticket], None] | None = None,
) -> dict[str, Any]:
    """Build the handler map for the coordination function group."""

    async def coordination_emit(
        args: dict[str, Any], status_cb: Any,
    ) -> dict[str, Any]:
        """Emit a coordination signal to notify other agents."""
        signal_type = args.get("signal_type", "")
        context = args.get("context", "")

        if not signal_type:
            return {"error": "signal_type is required"}

        if status_cb:
            status_cb(f"Emitting signal: {signal_type}")

        try:
            ticket = create_ticket(
                "",  # No objective — coordination tickets carry context, not work.
                kind="coordination",
                signal_type=signal_type,
                context=context,
            )
        except Exception as e:
            logger.exception("coordination_emit failed")
            return {"error": str(e)}

        if status_cb:
            status_cb(None, None)

        if on_coordination_emit:
            on_coordination_emit(ticket)

        return {
            "ticket_id": ticket.id,
            "signal_type": signal_type,
            "emitted": True,
        }

    async def coordination_pull_digest_tiles(
        args: dict[str, Any], status_cb: Any,
    ) -> dict[str, Any]:
        """Pull all digest tiles from standard playbook runs."""
        from bees.ticket import TICKETS_DIR
        import json

        if status_cb:
            status_cb("Pulling latest digest tiles...")

        tiles = []
        runs_dir = TICKETS_DIR / "_runs"
        if runs_dir.exists():
            for run_dir in runs_dir.iterdir():
                if not run_dir.is_dir():
                    continue
                tile_path = run_dir / "filesystem" / "digest_tile.json"
                if tile_path.exists():
                    try:
                        content = json.loads(tile_path.read_text(encoding="utf-8"))
                        tiles.append({"run_id": run_dir.name, "tile": content})
                    except Exception as e:
                        logger.warning("Failed to read digest tile %s: %s", tile_path, e)

        if status_cb:
            status_cb(None, None)

        return {"tiles": tiles}

    return {
        "coordination_emit": coordination_emit,
        "coordination_pull_digest_tiles": coordination_pull_digest_tiles,
    }


def get_coordination_function_group(
    on_coordination_emit: Callable[[Ticket], None] | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with coordination_emit."""
    handlers = _make_handlers(on_coordination_emit)
    return assemble_function_group(_LOADED, handlers)

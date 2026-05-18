# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Events function group — inter-agent communication.

Exposes ``events_send_to_parent`` (direct parent delivery),
``events_broadcast`` (pub/sub via watch_events), and
``events_yield`` (report task outcome and suspend for next task)
so agents can communicate mid-session.
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any, Callable

from bees.subagent_scope import SubagentScope

from bees.protocols.functions import (
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)

from bees.protocols.handler_types import (
    SuspendError,
    WaitForInputEvent,
)

from bees.agent import Agent

__all__ = ["get_events_function_group_factory"]

logger = logging.getLogger(__name__)

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

# Load declarations once at module level.
_LOADED = load_declarations("events", declarations_dir=_DECLARATIONS_DIR)


def _record_task_completion(
    agent_id: str,
    scheduler: Any,
    task: Any,
) -> None:
    """Append a task completion record to the session's tracking file.

    Records ``{task_id, turn, completed_at}`` in
    ``task_completions.json`` inside the session directory.  This is
    read by the rollback handler to identify tasks completed after a
    fork point so they can be re-queued.

    Best-effort — failures are logged but don't block the yield.
    """
    try:
        agent = scheduler.store.get(agent_id)
        if not agent or not agent.metadata.active_session:
            return

        session_dir = (
            agent.dir / "sessions" / agent.metadata.active_session
        )
        if not session_dir.exists():
            return

        completions_file = session_dir / "task_completions.json"
        completions: list[dict[str, Any]] = []
        if completions_file.exists():
            completions = json.loads(
                completions_file.read_text(encoding="utf-8")
            )

        completions.append({
            "task_id": task.id,
            "turn": agent.metadata.turns or 0,
            "completed_at": task.completed_at,
        })

        completions_file.write_text(
            json.dumps(completions, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except Exception as exc:
        logger.warning(
            "Failed to record task completion for rollback: %s", exc,
        )

def _make_handlers(
    *,
    on_events_broadcast: Callable[[Agent], None] | None = None,
    deliver_to_parent: Callable[[dict[str, Any]], None] | None = None,
    ticket_id: str | None = None,
    caller_agent_id: str | None = None,
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
            # Create a coordination agent via the store.
            agent = scheduler.store.create(
                "",  # No objective — coordination agents carry context, not work.
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
            on_events_broadcast(agent)

        return {
            "agent_id": agent.id,
            "type": event_type,
            "broadcast": True,
        }

    async def events_yield(
        args: dict[str, Any], status_cb: Any,
    ) -> dict[str, Any]:
        """Report current task outcome and suspend until next task.

        This is the infinite agent's analog of ``system_objective_fulfilled``.
        Instead of terminating the session, it delivers the result to the
        parent and suspends until the next task arrives.

        Steps:
        1. Find the agent's active (in-progress) task via TaskFileStore.
        2. Mark it completed with the outcome.
        3. Deliver completion update to parent.
        4. Check for pending context updates — return immediately if present.
        5. Otherwise suspend via SuspendError.
        """
        outcome = args.get("outcome", "")

        if not outcome:
            return {"error": "outcome is required"}

        agent_id = caller_agent_id or ticket_id
        if not agent_id or not scheduler:
            return {"error": "Scheduler not available"}

        if status_cb:
            status_cb("Yielding task result")

        # 1. Find the active task for this agent.
        task_file_store = getattr(scheduler.store, '_task_file_store', None)
        if task_file_store:
            tasks = task_file_store.query_by_assignee(agent_id)
            # Find the in-progress task (there should be at most one).
            active_task = next(
                (t for t in tasks if t.status == "in_progress"), None
            )
            if active_task:
                # 2. Mark it completed.
                from datetime import datetime, timezone
                active_task.status = "completed"
                active_task.outcome = outcome
                active_task.completed_at = (
                    datetime.now(timezone.utc).isoformat()
                )
                task_file_store.save(active_task)
                logger.info(
                    "events_yield: task %s completed for agent %s",
                    active_task.id[:8], agent_id[:8],
                )

                # 2b. Record completion for rollback correlation.
                # Written to task_completions.json in the session dir
                # so rollback can identify tasks completed after the
                # fork point and re-queue them.
                _record_task_completion(
                    agent_id, scheduler, active_task,
                )

        # 3. Deliver completion update to parent.
        if deliver_to_parent:
            update = {
                "task_id": agent_id,
                "status": "completed",
                "outcome": outcome,
                "from_slug": scope.slug_path if scope else None,
                "type": "task_completed",
            }
            try:
                deliver_to_parent(update)
            except Exception as e:
                logger.exception("events_yield: deliver_to_parent failed")
                return {"error": f"Failed to deliver result to parent: {e}"}

        # Also set the outcome on the agent metadata so it's visible
        # in hivetool and agents_check_status.
        agent = scheduler.store.get(agent_id)
        if agent:
            agent.metadata.outcome = outcome
            scheduler.store.save_metadata(agent)

        if status_cb:
            status_cb(None, None)

        # Suspend unconditionally. If context updates are already
        # buffered, _handle_suspend in task_runner.py will pick them
        # up and auto-resume — one delivery path, no race.
        #
        # The original inline check here consumed buffered updates
        # and returned {resumed: true}, but _handle_suspend would
        # then reload the agent and find the same updates again if
        # delivery happened between the two checks (Phase 7 bug).
        request_id = str(uuid.uuid4())
        event = WaitForInputEvent(
            request_id=request_id,
            prompt={},
            input_type="any",
        )
        function_call_part = {
            "functionCall": {
                "name": "events_yield",
                "args": args,
            }
        }
        raise SuspendError(event, function_call_part)

    return {
        "events_send_to_parent": events_send_to_parent,
        "events_broadcast": events_broadcast,
        "events_yield": events_yield,
    }


def get_events_function_group_factory(
    *,
    on_events_broadcast: Callable[[Agent], None] | None = None,
    deliver_to_parent: Callable[[dict[str, Any]], None] | None = None,
    ticket_id: str | None = None,
    caller_agent_id: str | None = None,
    scope: SubagentScope | None = None,
    scheduler: Any | None = None,
) -> FunctionGroupFactory:
    """Build a FunctionGroupFactory for events."""
    def factory(hooks: SessionHooks) -> FunctionGroup:
        handlers = _make_handlers(
            on_events_broadcast=on_events_broadcast,
            deliver_to_parent=deliver_to_parent,
            ticket_id=ticket_id,
            caller_agent_id=caller_agent_id,
            scope=scope,
            scheduler=scheduler,
        )
        return assemble_function_group(_LOADED, handlers)
    return factory

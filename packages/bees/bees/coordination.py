# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Coordination task routing — event dispatch for cross-agent signals.

Routes coordination tasks (lightweight tasks carrying event payloads)
to matching subscribers.  Delivery is durable: the coordination task
stays ``available`` until every subscriber has been delivered to.

This module is extracted as-is from the scheduler with an eye toward
future replacement by a purpose-built event dispatcher.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from bees.playbook import run_event_hooks
from bees.protocols.events import BroadcastReceived, EventEmitter, TaskDone
from bees.task_store import TaskStore
from bees.ticket import Ticket

logger = logging.getLogger(__name__)

__all__ = ["route_coordination_task"]


async def route_coordination_task(
    task: Ticket,
    store: TaskStore,
    running_tasks: set[str],
    emit: EventEmitter,
) -> None:
    """Route a coordination task's signal to matching subscribers.

    Delivery is durable: the coordination task stays ``available``
    until every matching subscriber has been delivered to. Subscribers
    that are busy (running or not idle) are skipped and retried in the
    next scheduler cycle.

    This design survives server restarts — undelivered coordination
    tasks remain ``available`` on disk and are re-routed on startup.
    """
    signal_type = task.metadata.signal_type or ""
    payload = task.metadata.context or ""
    source_tags = set(task.metadata.tags or [])
    delivered = set(task.metadata.delivered_to or [])

    # Find all matching subscribers.
    source_run_id = task.metadata.playbook_run_id
    subscribers: list[Ticket] = []
    for candidate in store.query_all():
        if candidate.id == task.id:
            continue
        if not candidate.metadata.watch_events:
            continue
        # Run-ID scoping: if the signal is scoped to a run,
        # only deliver to subscribers in that same run.
        if source_run_id and candidate.metadata.playbook_run_id != source_run_id:
            continue
        for watch in candidate.metadata.watch_events:
            if watch.get("type") != signal_type:
                continue
            # Tag filtering.
            tag_filters = watch.get("tags", [])
            exclude = {f[1:] for f in tag_filters if f.startswith("!")}
            require = {f for f in tag_filters if not f.startswith("!")}
            if source_tags & exclude:
                continue
            if require and not (source_tags & require):
                continue
            subscribers.append(candidate)
            break

    # Try to deliver to each subscriber not yet delivered.
    all_delivered = True
    for sub in subscribers:
        if sub.id in delivered:
            continue

        # Let the playbook hook intercept before delivery.
        result = run_event_hooks(signal_type, payload, sub, store)
        if result is None:
            # Hook ate the event — mark delivered, skip agent.
            delivered.add(sub.id)
            store.save_metadata(sub)
            logger.info(
                "Coordination %s eaten by hook for %s",
                task.id[:8],
                sub.id[:8],
            )
            continue

        if (
            sub.metadata.status == "suspended"
            and sub.metadata.assignee == "user"
            and sub.id not in running_tasks
        ):
            # Idle — deliver immediately.
            response_path = sub.dir / "response.json"
            response_path.write_text(
                json.dumps(
                    {"context_updates": [result]},
                    indent=2,
                    ensure_ascii=False,
                )
                + "\n"
            )
            sub.metadata.assignee = "agent"
            store.save_metadata(sub)
            delivered.add(sub.id)
            logger.info(
                "Coordination %s delivered to %s",
                task.id[:8],
                sub.id[:8],
            )
        else:
            # Busy — skip, will retry next cycle.
            all_delivered = False

    # Update delivery tracking.
    task.metadata.delivered_to = list(delivered)

    if all_delivered:
        task.metadata.status = "completed"
        task.metadata.completed_at = datetime.now(timezone.utc).isoformat()
        logger.info(
            "Coordination task %s fully delivered (signal_type=%s)",
            task.id[:8],
            signal_type,
        )

    store.save_metadata(task)

    # Notify application consumers about the broadcast.
    await emit(BroadcastReceived(
        signal_type=signal_type,
        message=payload,
        source_task_id=task.id,
    ))

    # Broadcast the updated coordination task to the UI.
    await emit(TaskDone(task=task))

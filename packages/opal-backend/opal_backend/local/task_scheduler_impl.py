# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""LocalTaskScheduler — asyncio.create_task-based TaskScheduler.

Runs node tasks as asyncio tasks in the same process. Tracks
tasks for cancellation support.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Coroutine

__all__ = ["LocalTaskScheduler"]


class LocalTaskScheduler:
    """Runs node tasks as asyncio tasks in the same process.

    The ``run_fn`` callback receives ``(session_id, node_id)`` and
    is responsible for the full node lifecycle (load inputs, run
    handler, complete node, schedule downstream).
    """

    def __init__(
        self,
        run_fn: Callable[[str, str], Coroutine[Any, Any, None]],
    ) -> None:
        self._run_fn = run_fn
        self._tasks: dict[str, asyncio.Task[None]] = {}

    async def schedule(
        self, session_id: str, node_id: str,
    ) -> None:
        """Dispatch a node task as an asyncio.Task."""
        task = asyncio.create_task(
            self._run_fn(session_id, node_id),
            name=f"node-{session_id}-{node_id}",
        )
        key = f"{session_id}:{node_id}"
        self._tasks[key] = task
        # Auto-cleanup when task completes.
        task.add_done_callback(lambda _: self._tasks.pop(key, None))

    async def cancel(
        self, session_id: str, node_id: str | None = None,
    ) -> None:
        """Cancel a running node task (or all tasks in a session)."""
        if node_id:
            key = f"{session_id}:{node_id}"
            task = self._tasks.pop(key, None)
            if task and not task.done():
                task.cancel()
        else:
            prefix = f"{session_id}:"
            for key in list(self._tasks):
                if key.startswith(prefix):
                    task = self._tasks.pop(key)
                    if not task.done():
                        task.cancel()

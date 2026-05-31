# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""TaskScheduler protocol — node task dispatch abstraction.

Abstracts HOW a node task is started. The graph runner calls
``schedule()`` whenever a node becomes ready; the implementation
decides where and how the task runs.

Only stdlib + typing — no external deps (synced to production).
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

__all__ = ["TaskScheduler"]


@runtime_checkable
class TaskScheduler(Protocol):
    """Protocol for dispatching node tasks.

    Implementations:
    - ``LocalTaskScheduler`` (``local/task_scheduler_impl.py``)
      — ``asyncio.create_task()`` in the same process.
    - Production — enqueues an RPC to a load-balanced task worker.
    """

    async def schedule(
        self, session_id: str, node_id: str,
    ) -> None:
        """Dispatch a node task for execution.

        The implementation is responsible for:
        1. Loading node inputs from GraphSessionStore
        2. Running the node handler
        3. Calling complete_node() on completion
        4. Scheduling newly-ready downstream nodes

        Or alternatively, just enqueuing the work for a worker
        that does all of the above.
        """
        ...

    async def cancel(
        self, session_id: str, node_id: str | None = None,
    ) -> None:
        """Cancel a running node task (or all tasks in a session)."""
        ...

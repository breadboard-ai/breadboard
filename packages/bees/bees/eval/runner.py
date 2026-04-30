# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Single-case eval runner.

Copies a hive directory to a working location, creates a ``Bees`` instance
with real model runners, and runs it to completion (or suspension).  The
original hive is never modified.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from bees import Bees
from bees.protocols.events import (
    CycleComplete,
    CycleStarted,
    TaskAdded,
    TaskDone,
    TaskStarted,
)
from bees.runners.gemini import GeminiRunner
from bees.runners.live import LiveRunner
from bees.ticket import Ticket

from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger(__name__)

__all__ = ["CaseResult", "TaskSummary", "run_case"]


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass
class TaskSummary:
    """Summary of a single task after a run."""

    id: str
    title: str | None
    template: str | None
    status: str
    error: str | None = None
    outcome: str | None = None


@dataclass
class CaseResult:
    """Result of running a single eval case."""

    case_name: str
    status: str  # "completed" | "suspended" | "failed" | "mixed"
    duration_s: float
    task_count: int
    summaries: list[dict] = field(default_factory=list)
    tasks: list[TaskSummary] = field(default_factory=list)
    error: str | None = None


def _derive_status(tasks: list[TaskSummary]) -> str:
    """Derive an overall status from individual task statuses."""
    statuses = {t.status for t in tasks}
    if not statuses:
        return "completed"
    if statuses == {"completed"}:
        return "completed"
    if "failed" in statuses:
        return "failed"
    if "suspended" in statuses:
        return "suspended"
    return "mixed"


# ---------------------------------------------------------------------------
# Event observers (logging)
# ---------------------------------------------------------------------------


async def _on_task_added(event: TaskAdded) -> None:
    task = event.task
    logger.info(
        "Task added: %s (%s)",
        task.metadata.title or task.id[:8], task.id[:8],
    )


async def _on_cycle_start(event: CycleStarted) -> None:
    logger.info(
        "Cycle %d: %d new + %d resumable",
        event.cycle, event.available, event.resumable,
    )


async def _on_task_start(event: TaskStarted) -> None:
    task = event.task
    logger.info(
        "Task running: %s (%s)",
        task.metadata.title or task.id[:8], task.id[:8],
    )


async def _on_task_done(event: TaskDone) -> None:
    task = event.task
    logger.info(
        "Task %s: %s (%s)",
        task.metadata.status,
        task.metadata.title or task.id[:8],
        task.id[:8],
    )


async def _on_cycle_complete(event: CycleComplete) -> None:
    logger.info("All cycles complete (%d total)", event.total_cycles)


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def _create_runners(
    gemini_key: str,
) -> tuple[dict[str, Any], httpx.AsyncClient]:
    """Create session runners and return them with the HTTP client.

    The caller is responsible for closing the HTTP client after use.
    """
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    backend = HttpBackendClient(
        upstream_base="",
        httpx_client=http_client,
        access_token="",
        gemini_key=gemini_key,
    )

    runners = {
        "generate": GeminiRunner(backend),
        "live": LiveRunner(api_key=gemini_key),
    }

    return runners, http_client


async def run_case(
    hive_dir: Path,
    output_dir: Path,
    gemini_key: str,
    *,
    case_name: str | None = None,
) -> CaseResult:
    """Run a single eval case.

    Copies the hive to ``output_dir``, runs it to completion (or
    suspension), and returns a structured result.

    Args:
        hive_dir: Path to the source hive directory.
        output_dir: Working directory for this run.  The hive is copied
            here; the original is never modified.
        gemini_key: Gemini API key for model calls.
        case_name: Human-readable name for this case (defaults to
            the hive directory name).
    """
    name = case_name or hive_dir.name

    # Copy the hive to the output directory.
    work_dir = output_dir / "hive"
    if work_dir.exists():
        shutil.rmtree(work_dir)
    shutil.copytree(hive_dir, work_dir)

    logger.info("Running case '%s': %s → %s", name, hive_dir, work_dir)

    runners, http_client = _create_runners(gemini_key)
    start = time.monotonic()

    try:
        bees = Bees(work_dir, runners)

        # Wire event observers for logging.
        bees.on(TaskAdded, _on_task_added)
        bees.on(CycleStarted, _on_cycle_start)
        bees.on(TaskStarted, _on_task_start)
        bees.on(TaskDone, _on_task_done)
        bees.on(CycleComplete, _on_cycle_complete)

        summaries = await bees.run()
    except Exception as exc:
        duration = time.monotonic() - start
        logger.error("Case '%s' failed: %s", name, exc)
        return CaseResult(
            case_name=name,
            status="failed",
            duration_s=duration,
            task_count=0,
            error=str(exc),
        )
    finally:
        await http_client.aclose()

    duration = time.monotonic() - start

    # Query final task states from the store.
    from bees.task_store import TaskStore

    store = TaskStore(work_dir)
    all_tasks = store.query_all()

    task_summaries = [
        TaskSummary(
            id=t.id,
            title=t.metadata.title,
            template=t.metadata.playbook_id,
            status=t.metadata.status,
            error=t.metadata.error,
            outcome=t.metadata.outcome,
        )
        for t in all_tasks
    ]

    status = _derive_status(task_summaries)

    logger.info(
        "Case '%s' %s in %.1fs (%d tasks)",
        name, status, duration, len(task_summaries),
    )

    return CaseResult(
        case_name=name,
        status=status,
        duration_s=duration,
        task_count=len(task_summaries),
        summaries=summaries,
        tasks=task_summaries,
    )

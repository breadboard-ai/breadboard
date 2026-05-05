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
    root_task: str | None = None,
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
        root_task: Override the root template from SYSTEM.yaml.
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
        bees = Bees(work_dir, runners, root_override=root_task)

        # Wire event observers for logging.
        bees.on(TaskAdded, _on_task_added)
        bees.on(CycleStarted, _on_cycle_start)
        bees.on(TaskStarted, _on_task_start)
        bees.on(TaskDone, _on_task_done)
        bees.on(CycleComplete, _on_cycle_complete)

        # Load case config from eval/config.yaml.
        import yaml
        config_path = work_dir / "eval" / "config.yaml"
        config_data = {}
        max_iterations = 20
        if config_path.is_file():
            try:
                config_data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
                if isinstance(config_data, dict):
                    max_iterations = config_data.get("max_iterations", 20)
            except Exception as e:
                logger.warning("Failed to parse eval/config.yaml: %s", e)

        from bees.task_store import TaskStore
        store = TaskStore(work_dir)

        iteration = 0
        all_summaries = []

        while iteration < max_iterations:
            iteration += 1
            logger.info("Eval iteration %d for case '%s'", iteration, name)
            summaries = await bees.run()
            if summaries:
                all_summaries.extend(summaries)

            # Check for tasks suspended waiting for user input.
            user_suspended_tasks = [
                t for t in store.query_all()
                if t.metadata.status == "suspended" and t.metadata.assignee == "user"
                and not (t.metadata.tags and "eval-persistent-user" in t.metadata.tags)
            ]

            if not user_suspended_tasks:
                break

            # Find an active persistent simulated user task by its tag.
            all_tasks = store.query_all()
            sim_user_task = None
            for t in all_tasks:
                if t.metadata.tags and "eval-persistent-user" in t.metadata.tags:
                    if t.metadata.status not in ("completed", "failed", "cancelled"):
                        sim_user_task = t
                        break

            for task_a in user_suspended_tasks:
                suspend_event = task_a.metadata.suspend_event or {}
                agent_question = ""
                
                # Extract prompt text.
                if "waitForInput" in suspend_event:
                    prompt_dict = suspend_event["waitForInput"].get("prompt", {})
                    parts = prompt_dict.get("parts", [])
                    agent_question = "".join([p["text"] for p in parts if "text" in p])
                elif "waitForChoice" in suspend_event:
                    prompt_dict = suspend_event["waitForChoice"].get("prompt", {})
                    parts = prompt_dict.get("parts", [])
                    agent_question = "".join([p["text"] for p in parts if "text" in p])
                    choices = suspend_event["waitForChoice"].get("choices", [])
                    choice_lines = []
                    for c in choices:
                        c_id = c.get("id", "")
                        c_parts = c.get("content", {}).get("parts", [])
                        c_text = "".join([p["text"] for p in c_parts if "text" in p])
                        choice_lines.append(f"  * [{c_id}]: {c_text}")
                    if choice_lines:
                        agent_question += "\n\nAvailable options:\n" + "\n".join(choice_lines)

                if not agent_question:
                    agent_question = "Please respond."

                if sim_user_task is None:
                    # Strict declarative configuration checking — fail loudly if missing or incomplete.
                    if "simulated_user" not in config_data:
                        raise ValueError(
                            f"Evaluation configuration missing 'simulated_user' section in {config_path}. "
                            f"Task '{task_a.id[:8]}' is suspended waiting for user input, but no user specification was provided."
                        )
                    user_spec = config_data["simulated_user"]
                    if not isinstance(user_spec, dict) or "objective" not in user_spec:
                        raise ValueError(
                            f"Missing required 'objective' prompt string inside 'simulated_user' config section in {config_path}."
                        )
                    if "functions" not in user_spec:
                        raise ValueError(
                            f"Missing required 'functions' allowlist array inside 'simulated_user' config section in {config_path}."
                        )

                    # Turn 1: Combine persona objective and first question cleanly without preamble boilerplate.
                    objective_str = f"{user_spec['objective']}\n\n<inquiry>\n{agent_question}\n</inquiry>"
                    sim_user_task = store.create(
                        objective=objective_str,
                        title=user_spec.get("title", "Simulated User for conversation"),
                        functions=user_spec["functions"],
                        model=user_spec.get("model"),
                        tags=["eval-persistent-user"],
                    )
                    logger.info("Created stateful simulated user task: %s", sim_user_task.id[:8])
                else:
                    # Turn 2+: Pass follow-up question to the existing suspended simulated user session.
                    logger.info("Handing off question to simulated user task: %s", sim_user_task.id[:8])
                    store.respond(sim_user_task.id, {"text": agent_question})

            # Run waves again to let the simulated user compute its response turn.
            sim_summaries = await bees.run()
            if sim_summaries:
                all_summaries.extend(sim_summaries)

            # Now collect the user replies from the simulated user task and deliver them back to the original tasks.
            if sim_user_task:
                sim_user_task = store.get(sim_user_task.id)

            if sim_user_task and sim_user_task.metadata.status == "completed":
                logger.info("Simulated user has autonomously concluded the conversation via system tools.")
                break

            if sim_user_task and sim_user_task.metadata.status == "suspended":
                sim_event = sim_user_task.metadata.suspend_event or {}
                user_reply = ""
                if "waitForInput" in sim_event:
                    prompt_dict = sim_event.get("waitForInput", {}).get("prompt", {})
                    parts = prompt_dict.get("parts", [])
                    user_reply = "".join([p["text"] for p in parts if "text" in p])

                if not user_reply:
                    user_reply = "Yes."

                logger.info("Simulated user replied: %r", user_reply)

                # Feed the user response back to each original task waiting for it.
                for task_a in user_suspended_tasks:
                    store.respond(task_a.id, {"text": user_reply})

        summaries = all_summaries
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
        if not (t.metadata.tags and "eval-persistent-user" in t.metadata.tags)
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

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Box — filesystem-driven orchestrator for Bees.

Named after the hive box, the physical structure that houses bees.
Instead of an HTTP server, the box watches the hive directory for
changes and drives the scheduler through filesystem events.

Two conceptual watchers share a single ``watchfiles.awatch`` stream:

- **Config watcher** (cold restart): changes to ``config/SYSTEM.yaml``,
  ``config/TEMPLATES.yaml``, ``config/hooks/``, or ``skills/`` cause
  the box to shut down the current ``Bees`` instance and restart with
  fresh configuration.

- **Task watcher** (hot trigger): changes under ``tickets/`` wake the
  scheduler to re-evaluate available work.

Usage::

    python -m bees.box
    # or
    npm run dev:box -w packages/bees
"""

from __future__ import annotations

import asyncio
import logging
import signal
import sys
from pathlib import Path
from typing import Literal

from bees.mutations import MutationManager

import httpx
from watchfiles import awatch, Change

from app.auth import load_gemini_key
from app.config import load_hive_dir
from bees import Bees
from bees.protocols.events import (
    CycleComplete,
    CycleStarted,
    TaskAdded,
    TaskDone,
    TaskEvent,
    TaskStarted,
)
from bees.runners.gemini import GeminiRunner
from bees.runners.live import LiveRunner
from bees.ticket import Ticket
from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger("bees.box")


# ---------------------------------------------------------------------------
# Change classification
# ---------------------------------------------------------------------------

ChangeKind = Literal["config", "task", "mutation", "ignore"]


def classify_change(path: Path, hive_dir: Path) -> ChangeKind:
    """Classify a changed path relative to the hive directory.

    Returns:
        ``"config"`` for configuration files that require a restart,
        ``"task"`` for ticket changes that should trigger the scheduler,
        ``"mutation"`` for mutation files that need atomic processing,
        ``"ignore"`` for everything else (logs, temp files, etc.).
    """
    try:
        rel = path.relative_to(hive_dir)
    except ValueError:
        return "ignore"

    parts = rel.parts
    if not parts:
        return "ignore"

    top = parts[0]

    # Config paths → cold restart.
    if top == "config":
        return "config"
    if top == "skills":
        return "config"

    # Mutation paths → process between shutdown and restart.
    # Ignore result files (written by the box itself).
    if top == "mutations":
        if path.name.endswith(".result.json"):
            return "ignore"
        if path.name.startswith("."):
            return "ignore"
        return "mutation"

    # Task paths → hot trigger.
    if top == "tickets":
        return "task"

    return "ignore"


# ---------------------------------------------------------------------------
# Lifecycle hooks → logging
# ---------------------------------------------------------------------------


async def _on_task_added(event: TaskAdded) -> None:
    task = event.task
    logger.info("Agent added: %s (%s)", task.metadata.title or task.id[:8], task.id[:8])


async def _on_cycle_start(event: CycleStarted) -> None:
    logger.info(
        "Cycle %d: %d new + %d resumable",
        event.cycle, event.available, event.resumable,
    )


async def _on_task_event(event: TaskEvent) -> None:
    logger.debug("Event [%s]: %s", event.task_id[:8], event.event.get("type", "unknown"))


async def _on_task_start(event: TaskStarted) -> None:
    task = event.task
    logger.info(
        "Agent running: %s (%s)",
        task.metadata.title or task.id[:8], task.id[:8],
    )


async def _on_task_done(event: TaskDone) -> None:
    task = event.task
    logger.info(
        "Agent %s: %s (%s)",
        task.metadata.status,
        task.metadata.title or task.id[:8],
        task.id[:8],
    )


async def _on_cycle_complete(event: CycleComplete) -> None:
    logger.info("All cycles complete (%d total)", event.total_cycles)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


async def run(
    hive_dir: Path, backend: HttpBackendClient, *, gemini_key: str,
) -> None:
    """Run the box — outer restart loop + inner file-watch loop.

    This function runs indefinitely until cancelled or interrupted.
    Config changes cause a restart (inner loop breaks, outer loop
    re-creates ``Bees``). Task changes trigger the scheduler.

    Mutations come in two flavors:

    - **Hot** (e.g., respond-to-task) — processed inline, then the
      scheduler is triggered.
    - **Cold** (e.g., reset) — processed in the quiescent gap between
      shutdown and restart.
    """
    logger.info("Box starting — watching %s", hive_dir)

    # Process any mutations that arrived while the box was down.
    startup_manager = MutationManager(hive_dir)
    if startup_manager.process_all():
        logger.info("Processed pending mutations on startup")

    # Write sentinel so hivetool knows the box is listening.
    startup_manager.activate()

    runner = GeminiRunner(backend)
    runners = {
        "generate": runner,
        "live": LiveRunner(api_key=gemini_key),
    }

    while True:
        bees = Bees(hive_dir, runners)

        bees.on(TaskAdded, _on_task_added)
        bees.on(CycleStarted, _on_cycle_start)
        bees.on(TaskEvent, _on_task_event)
        bees.on(TaskStarted, _on_task_start)
        bees.on(TaskDone, _on_task_done)
        bees.on(CycleComplete, _on_cycle_complete)

        await bees.listen()
        logger.info("Bees started — watching for changes")

        restart = False
        cold_pending = False
        try:
            async for changes in awatch(hive_dir):
                needs_restart = False
                needs_trigger = False
                needs_mutation = False

                for _change_type, changed_path in changes:
                    kind = classify_change(Path(changed_path), hive_dir)
                    if kind == "config":
                        needs_restart = True
                    elif kind == "task":
                        needs_trigger = True
                    elif kind == "mutation":
                        needs_mutation = True

                # Process mutations: hot mutations run inline,
                # cold mutations signal a restart.
                if needs_mutation:
                    manager = MutationManager(hive_dir, bees=bees)
                    outcome = manager.process_inline()
                    if outcome.hot_processed > 0:
                        needs_trigger = True
                    if outcome.cold_pending:
                        logger.info("Cold mutation pending — shutting down")
                        cold_pending = True
                        restart = True
                        break

                if needs_restart:
                    logger.info("Config change detected — restarting")
                    restart = True
                    break

                if needs_trigger:
                    logger.debug("Task change detected — triggering scheduler")
                    bees.trigger()

        except asyncio.CancelledError:
            logger.info("Box cancelled — shutting down")
            await bees.shutdown()
            MutationManager(hive_dir).deactivate()
            return

        await bees.shutdown()

        # Process cold mutations in the quiescent gap.
        if cold_pending:
            cold_manager = MutationManager(hive_dir)
            cold_manager.process_cold()

        if not restart:
            MutationManager(hive_dir).deactivate()
            return

        logger.info("Restarting bees...")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """CLI entry point for ``python -m bees.box``."""
    from dotenv import load_dotenv

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )

    load_dotenv()

    gemini_key = load_gemini_key()
    hive_dir = load_hive_dir()

    # Load hive-specific .env (e.g. OAuth credentials).
    # Runs after load_hive_dir so we know where the hive is.
    hive_env = hive_dir / ".env"
    if hive_env.is_file():
        load_dotenv(hive_env, override=True)
        logger.info("Loaded hive .env from %s", hive_env)

    http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    backend = HttpBackendClient(
        upstream_base="",
        httpx_client=http_client,
        access_token="",
        gemini_key=gemini_key,
    )

    loop = asyncio.new_event_loop()

    async def _run() -> None:
        try:
            await run(hive_dir, backend, gemini_key=gemini_key)
        finally:
            await http_client.aclose()

    # Clean shutdown on SIGINT/SIGTERM.
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: _cancel_all(loop))

    try:
        loop.run_until_complete(_run())
    finally:
        loop.close()


_shutdown_time: float = 0


def _cancel_all(loop: asyncio.AbstractEventLoop) -> None:
    """Cancel all running tasks for clean shutdown.

    npm forwards Ctrl+C as both SIGINT and SIGTERM nearly
    simultaneously, so we debounce: signals within 1 s of the first
    are treated as duplicates.  A genuinely separate press (>1 s later)
    force-exits.
    """
    import time

    global _shutdown_time
    now = time.monotonic()

    if _shutdown_time:
        if now - _shutdown_time < 1.0:
            return  # Duplicate from npm — ignore.
        # Genuine second press — force exit.
        logger.warning("Force-quitting (second signal)")
        import os
        os._exit(1)

    _shutdown_time = now
    for task in asyncio.all_tasks(loop):
        task.cancel()


if __name__ == "__main__":
    main()

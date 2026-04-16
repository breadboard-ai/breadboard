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

import httpx
from watchfiles import awatch, Change

from app.auth import load_gemini_key
from app.config import load_hive_dir
from bees import Bees
from bees.ticket import Ticket
from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger("bees.box")


# ---------------------------------------------------------------------------
# Change classification
# ---------------------------------------------------------------------------

ChangeKind = Literal["config", "task", "ignore"]


def classify_change(path: Path, hive_dir: Path) -> ChangeKind:
    """Classify a changed path relative to the hive directory.

    Returns:
        ``"config"`` for configuration files that require a restart,
        ``"task"`` for ticket changes that should trigger the scheduler,
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

    # Task paths → hot trigger.
    if top == "tickets":
        return "task"

    return "ignore"


# ---------------------------------------------------------------------------
# Lifecycle hooks → logging
# ---------------------------------------------------------------------------


async def _on_task_added(task: Ticket) -> None:
    logger.info("Agent added: %s (%s)", task.metadata.title or task.id[:8], task.id[:8])


async def _on_cycle_start(cycle: int, new: int, resumable: int) -> None:
    logger.info(
        "Cycle %d: %d new + %d resumable",
        cycle, new, resumable,
    )


async def _on_task_event(task_id: str, event: dict) -> None:
    logger.debug("Event [%s]: %s", task_id[:8], event.get("type", "unknown"))


async def _on_task_start(task: Ticket) -> None:
    logger.info(
        "Agent running: %s (%s)",
        task.metadata.title or task.id[:8], task.id[:8],
    )


async def _on_task_done(task: Ticket) -> None:
    logger.info(
        "Agent %s: %s (%s)",
        task.metadata.status,
        task.metadata.title or task.id[:8],
        task.id[:8],
    )


async def _on_cycle_complete(cycles: int) -> None:
    logger.info("All cycles complete (%d total)", cycles)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


async def run(hive_dir: Path, backend: HttpBackendClient) -> None:
    """Run the box — outer restart loop + inner file-watch loop.

    This function runs indefinitely until cancelled or interrupted.
    Config changes cause a restart (inner loop breaks, outer loop
    re-creates ``Bees``). Task changes trigger the scheduler.
    """
    logger.info("Box starting — watching %s", hive_dir)

    while True:
        bees = Bees(hive_dir, backend)

        bees.on("task_added", _on_task_added)
        bees.on("cycle_start", _on_cycle_start)
        bees.on("task_event", _on_task_event)
        bees.on("task_start", _on_task_start)
        bees.on("task_done", _on_task_done)
        bees.on("cycle_complete", _on_cycle_complete)

        await bees.listen()
        logger.info("Bees started — watching for changes")

        restart = False
        try:
            async for changes in awatch(hive_dir):
                needs_restart = False
                needs_trigger = False

                for _change_type, changed_path in changes:
                    kind = classify_change(Path(changed_path), hive_dir)
                    if kind == "config":
                        needs_restart = True
                    elif kind == "task":
                        needs_trigger = True

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
            return

        await bees.shutdown()
        if not restart:
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
            await run(hive_dir, backend)
        finally:
            await http_client.aclose()

    # Clean shutdown on SIGINT/SIGTERM.
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: _cancel_all(loop))

    try:
        loop.run_until_complete(_run())
    finally:
        loop.close()


def _cancel_all(loop: asyncio.AbstractEventLoop) -> None:
    """Cancel all running tasks for clean shutdown."""
    for task in asyncio.all_tasks(loop):
        task.cancel()


if __name__ == "__main__":
    main()

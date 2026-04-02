# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Lifecycle hooks for the opie playbook.

Auto-boots Opie at server startup if no opie-tagged ticket exists.
Auto-bundles digest UI when the agent produces an App.jsx.
"""

from __future__ import annotations

import logging
import subprocess

from bees.playbook import run_playbook
from bees.ticket import Ticket

logger = logging.getLogger(__name__)


def on_startup(tickets: list[Ticket]) -> list[Ticket]:
    """Boot Opie if no opie-tagged ticket exists."""
    has_opie = any(
        t.metadata.tags and "opie" in t.metadata.tags
        for t in tickets
    )
    if has_opie:
        return []
    return run_playbook("opie")


def on_ticket_done(ticket: Ticket) -> None:
    """Auto-build the UI bundle if the agent didn't.

    The digest step uses the ``ui-generator`` skill which produces an
    ``App.jsx``.  This hook ensures it gets bundled even if the agent
    skips the bundler step.
    """
    if ticket.metadata.status != "completed":
        return
    if not ticket.metadata.skills or "ui-generator" not in ticket.metadata.skills:
        return

    app_path = ticket.fs_dir / "App.jsx"
    app_lower = ticket.fs_dir / "app.jsx"
    if not (app_path.exists() or app_lower.exists()):
        return

    bundler_path = (
        ticket.fs_dir / "skills" / "ui-generator" / "tools" / "bundler.mjs"
    )
    if not bundler_path.exists():
        return

    logger.info("Auto-building UI bundle for ticket %s...", ticket.id)
    try:
        subprocess.run(
            ["node", str(bundler_path)],
            cwd=str(ticket.fs_dir),
            check=True,
            capture_output=True,
            text=True,
        )
        logger.info("Successfully auto-built bundle for %s", ticket.id)
    except subprocess.CalledProcessError as e:
        logger.error("Auto-bundle failed for %s:\n%s", ticket.id, e.stderr)

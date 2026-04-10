# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Lifecycle hooks for the ui-generator playbook.

Auto-bundles the UI if the agent produced an App.jsx but didn't run
the bundler itself.
"""

from __future__ import annotations

import logging
import subprocess

from bees.ticket import Ticket

logger = logging.getLogger(__name__)


def on_ticket_done(ticket: Ticket) -> None:
    """Auto-build the UI bundle if the agent skipped the bundler step."""
    if ticket.metadata.status != "completed":
        return

    fs_dir = ticket.fs_dir
    app_path = fs_dir / "App.jsx"
    app_lower = fs_dir / "app.jsx"
    if not (app_path.exists() or app_lower.exists()):
        return

    bundler_path = fs_dir / "skills" / "ui-generator" / "tools" / "bundler.mjs"
    if not bundler_path.exists():
        return

    logger.info("Auto-building UI bundle for ticket %s...", ticket.id)
    try:
        subprocess.run(
            ["node", str(bundler_path)],
            cwd=str(fs_dir),
            check=True,
            capture_output=True,
            text=True,
        )
        logger.info("Successfully auto-built bundle for %s", ticket.id)
    except subprocess.CalledProcessError as e:
        logger.error("Auto-bundle failed for %s:\n%s", ticket.id, e.stderr)

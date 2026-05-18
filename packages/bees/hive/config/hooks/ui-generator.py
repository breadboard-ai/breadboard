# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Lifecycle hooks for the ui-generator template.

Auto-bundles the UI if the agent produced an App.jsx but didn't run
the bundler itself.
"""

from __future__ import annotations

import logging
import subprocess

from bees.agent import Agent

logger = logging.getLogger(__name__)


def on_ticket_done(agent: Agent) -> None:
    """Auto-build the UI bundle if the agent skipped the bundler step."""
    if agent.metadata.status != "completed":
        return

    fs_dir = agent.fs_dir
    app_path = fs_dir / "App.jsx"
    app_lower = fs_dir / "app.jsx"
    if not (app_path.exists() or app_lower.exists()):
        return

    bundler_path = fs_dir / "skills" / "ui-generator" / "tools" / "bundler.mjs"
    if not bundler_path.exists():
        return

    logger.info("Auto-building UI bundle for agent %s...", agent.id)
    try:
        subprocess.run(
            ["node", str(bundler_path)],
            cwd=str(fs_dir),
            check=True,
            capture_output=True,
            text=True,
        )
        logger.info("Successfully auto-built bundle for %s", agent.id)
    except subprocess.CalledProcessError as e:
        logger.error("Auto-bundle failed for %s:\n%s", agent.id, e.stderr)

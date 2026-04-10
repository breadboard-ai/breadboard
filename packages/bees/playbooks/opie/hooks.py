# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Lifecycle hooks for the opie playbook.

Auto-boots Opie at server startup if no opie-tagged ticket exists.
Auto-bundles digest UI when the agent produces an App.jsx.
"""

from __future__ import annotations

import logging

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

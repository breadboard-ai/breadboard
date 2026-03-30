# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Lifecycle hooks for the app playbook.

Intercepts ``update_app_title`` signals to rename ticket titles —
e.g., "Interviewer" becomes "Grocery Tracker: Interviewer" once
the app's purpose is determined.
"""

from __future__ import annotations

from bees.ticket import Ticket


def on_event(signal_type: str, payload: str, ticket: Ticket) -> str | None:
    """Intercept coordination signals before delivery.

    Handles ``update_app_title``: updates the ticket's title and eats
    the signal (the agent doesn't need to know about the rename).
    """
    if signal_type == "update_app_title":
        ticket.metadata.title = payload
        ticket.save_metadata()
        return None  # Eaten.
    return payload

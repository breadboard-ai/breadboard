# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Live function group — instruction-only group for voice sessions.

Provides a voice-native system instruction that replaces the batch-oriented
``system.*`` instruction for ``runner: live`` sessions.  Loaded from
``bees/declarations/live.*`` files.

No function declarations or handlers — the termination functions
(``system_objective_fulfilled``, ``system_failed_to_fulfill_objective``)
are provided by the ``system.*`` group.
"""

from __future__ import annotations

from pathlib import Path

from bees.protocols.functions import (
    FunctionGroup,
    assemble_function_group,
    load_declarations,
)

__all__ = ["get_live_function_group"]

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

_LOADED = load_declarations("live", declarations_dir=_DECLARATIONS_DIR)


def get_live_function_group() -> FunctionGroup:
    """Build an instruction-only FunctionGroup for live sessions."""
    return assemble_function_group(_LOADED, {})

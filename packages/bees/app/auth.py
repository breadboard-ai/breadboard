# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Authentication helpers for the Bees reference application."""

from __future__ import annotations

import os
import sys


def load_gemini_key() -> str:
    """Load GEMINI_KEY from environment variables, exit on failure."""
    gemini_key = os.environ.get("GEMINI_KEY", "")
    if not gemini_key:
        print("Error: GEMINI_KEY not found in environment", file=sys.stderr)
        sys.exit(1)
    return gemini_key

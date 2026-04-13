# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Shared configuration for the Bees package.

Loads ``.env`` once at import time so that environment variables are
available to any module that imports from here — including modules
that compute directory paths at the module level.
"""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent.parent

# The root directory where Bees stores runtime data (tickets, logs).
# Defaults to "hive" relative to the package directory.
HIVE_DIR = PACKAGE_DIR / "hive"

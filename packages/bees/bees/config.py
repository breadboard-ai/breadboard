# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Shared configuration for the Bees package.

Loads ``.env`` once at import time so that environment variables are
available to any module that imports from here — including modules
that compute directory paths at the module level.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PACKAGE_DIR = Path(__file__).resolve().parent.parent

# Load .env early so BEES_HIVE_DIR (and GEMINI_KEY, etc.) are available
# before any module-level path constants are computed.
load_dotenv(PACKAGE_DIR / ".env")

# The root directory where Bees stores runtime data (tickets, logs).
# Configurable via the BEES_HIVE_DIR environment variable; defaults to "hive".
HIVE_DIR = PACKAGE_DIR / os.environ.get("BEES_HIVE_DIR", "hive")

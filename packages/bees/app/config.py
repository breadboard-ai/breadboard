# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Configuration helpers for the Bees reference application."""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv


def load_hive_dir() -> Path:
    """Load the hive directory from environment or default.

    Loads .env file if present. Relative paths are resolved relative to
    the packages/bees directory.
    """
    load_dotenv()
    
    package_dir = Path(__file__).resolve().parent.parent
    
    hive_dir_str = os.environ.get("BEES_HIVE_DIR", "hive")
    hive_dir = Path(hive_dir_str)
    
    if not hive_dir.is_absolute():
        return (package_dir / hive_dir).resolve()
    return hive_dir.resolve()

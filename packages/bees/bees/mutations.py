# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Mutation log — filesystem-based command channel.

The ``mutations/`` directory in the hive acts as a write-ahead log.
Clients (hivetool, scripts) write mutation files; the box processes
them atomically in the quiescent gap between shutdown and restart.

Each mutation is a JSON file (``{uuid}.json``) with a ``type`` field.
After processing, the box writes a result file (``{uuid}.result.json``)
with a ``status`` field (``"ok"`` or ``"error"``).

Supported mutation types:

- **reset** — Deletes all tasks (``tickets/``) and session logs
  (``logs/``). The root template re-boots automatically on restart.
"""

from __future__ import annotations

import json
import logging
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("bees.mutations")


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


@dataclass
class PendingMutation:
    """A mutation file that hasn't been processed yet."""

    path: Path
    data: dict[str, Any]

    @property
    def mutation_type(self) -> str:
        return self.data.get("type", "unknown")

    @property
    def result_path(self) -> Path:
        return self.path.with_suffix(".result.json")


# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------


def scan_pending(hive_dir: Path) -> list[PendingMutation]:
    """Find mutation files without a matching result file.

    Returns mutations sorted by filename (effectively by creation time
    if UUIDs are used, though ordering is best-effort).
    """
    mutations_dir = hive_dir / "mutations"
    if not mutations_dir.exists():
        return []

    pending: list[PendingMutation] = []

    for path in sorted(mutations_dir.glob("*.json")):
        # Skip result files.
        if path.stem.endswith(".result"):
            continue

        # Skip if already processed.
        result_path = path.with_suffix("").with_suffix(".result.json")
        if result_path.exists():
            continue

        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Skipping unreadable mutation %s: %s", path.name, exc)
            continue

        if not isinstance(data, dict) or "type" not in data:
            logger.warning("Skipping malformed mutation %s: missing 'type'", path.name)
            _write_result(
                result_path,
                {"status": "error", "error": "Malformed mutation: missing 'type'"},
            )
            continue

        pending.append(PendingMutation(path=path, data=data))

    return pending


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------


def process_all(hive_dir: Path) -> bool:
    """Process all pending mutations.

    Returns ``True`` if any mutations were processed (callers typically
    use this to decide whether a restart is needed).
    """
    pending = scan_pending(hive_dir)
    if not pending:
        return False

    for mutation in pending:
        logger.info("Processing mutation: %s (%s)", mutation.mutation_type, mutation.path.name)
        _dispatch(mutation, hive_dir)

    return True


def _dispatch(mutation: PendingMutation, hive_dir: Path) -> None:
    """Dispatch a mutation by type and write the result."""
    try:
        match mutation.mutation_type:
            case "reset":
                _execute_reset(hive_dir)
            case _:
                _write_result(
                    mutation.result_path,
                    {
                        "status": "error",
                        "error": f"Unknown mutation type: {mutation.mutation_type}",
                    },
                )
                return

        _write_result(mutation.result_path, {"status": "ok"})
        logger.info("Mutation complete: %s", mutation.mutation_type)

    except Exception as exc:
        logger.exception("Mutation failed: %s", mutation.mutation_type)
        _write_result(
            mutation.result_path,
            {"status": "error", "error": str(exc)},
        )


# ---------------------------------------------------------------------------
# Mutation handlers
# ---------------------------------------------------------------------------


def _execute_reset(hive_dir: Path) -> None:
    """Delete all tasks and session logs.

    Removes the contents of ``tickets/`` and ``logs/`` while preserving
    the directories themselves (so watchers don't lose their handles).
    """
    for subdir_name in ("tickets", "logs"):
        subdir = hive_dir / subdir_name
        if not subdir.exists():
            continue

        for child in subdir.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()

        logger.info("Cleared %s/", subdir_name)


# ---------------------------------------------------------------------------
# Result writing
# ---------------------------------------------------------------------------


def _write_result(result_path: Path, result: dict[str, Any]) -> None:
    """Write a mutation result file."""
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    )

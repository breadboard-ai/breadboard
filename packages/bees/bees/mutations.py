# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Mutation log — filesystem-based command channel.

The ``mutations/`` directory in the hive acts as a write-ahead log.
Clients (hivetool, scripts) write mutation files; the box processes
them atomically.

Each mutation is a JSON file (``{uuid}.json``) with a ``type`` field.
After processing, the box writes a result file (``{uuid}.result.json``)
with a ``status`` field (``"ok"`` or ``"error"``).

Two processing modes:

- **Cold** mutations (e.g., ``reset``) require quiescence — the box
  shuts down Bees, processes the mutation, then restarts.
- **Hot** mutations (e.g., ``respond-to-task``, ``create-task-group``)
  are processed inline while the scheduler is running.  The box
  executes all writes atomically, then triggers the scheduler once.

Supported mutation types:

- **reset** (cold) — Deletes all tasks and session logs.
- **respond-to-task** (hot) — Writes ``response.json`` and flips
  ``assignee`` to ``"agent"`` atomically.
- **create-task-group** (hot) — Creates multiple tasks with
  intra-batch dependency resolution via named refs.
"""

from __future__ import annotations

import json
import logging
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bees.task_store import TaskStore

logger = logging.getLogger("bees.mutations")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Mutations that require shutdown → process → restart.
COLD_MUTATIONS = frozenset({"reset"})


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

    @property
    def is_cold(self) -> bool:
        return self.mutation_type in COLD_MUTATIONS


@dataclass
class MutationOutcome:
    """Result of inline mutation processing."""

    hot_processed: int = 0
    cold_pending: bool = False
    created_tasks: dict[str, str] = field(default_factory=dict)
    """Mapping of ref → task_id for create-task-group results."""


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
# Processing — two modes
# ---------------------------------------------------------------------------


def process_all(hive_dir: Path) -> bool:
    """Process all pending mutations (startup).

    Handles both hot and cold mutations.  Used when the box starts
    and no Bees instance is running yet.

    Returns ``True`` if any mutations were processed.
    """
    pending = scan_pending(hive_dir)
    if not pending:
        return False

    for mutation in pending:
        logger.info("Processing mutation: %s (%s)", mutation.mutation_type, mutation.path.name)
        _dispatch(mutation, hive_dir)

    return True


def process_inline(hive_dir: Path) -> MutationOutcome:
    """Process hot mutations inline while the scheduler is running.

    Cold mutations are not processed — they're flagged in the outcome
    so the caller can initiate a shutdown/restart cycle.

    Returns a ``MutationOutcome`` indicating what happened.
    """
    pending = scan_pending(hive_dir)
    outcome = MutationOutcome()

    for mutation in pending:
        if mutation.is_cold:
            outcome.cold_pending = True
            continue

        logger.info("Processing hot mutation: %s (%s)", mutation.mutation_type, mutation.path.name)
        result = _dispatch(mutation, hive_dir)
        if result:
            outcome.hot_processed += 1
            if result.get("created"):
                outcome.created_tasks.update(result["created"])

    return outcome


def process_cold(hive_dir: Path) -> bool:
    """Process cold mutations only (requires quiescent state).

    Called in the gap between Bees shutdown and restart.
    Returns ``True`` if any cold mutations were processed.
    """
    pending = scan_pending(hive_dir)
    processed = False

    for mutation in pending:
        if not mutation.is_cold:
            continue

        logger.info("Processing cold mutation: %s (%s)", mutation.mutation_type, mutation.path.name)
        _dispatch(mutation, hive_dir)
        processed = True

    return processed


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------


def _dispatch(mutation: PendingMutation, hive_dir: Path) -> dict[str, Any] | None:
    """Dispatch a mutation by type and write the result.

    Returns extra result data on success (e.g., created task IDs),
    or ``None`` on failure.
    """
    try:
        extra: dict[str, Any] = {}

        match mutation.mutation_type:
            case "reset":
                _execute_reset(hive_dir)
            case "respond-to-task":
                _execute_respond(hive_dir, mutation)
            case "create-task-group":
                extra = _execute_create_group(hive_dir, mutation)
            case _:
                _write_result(
                    mutation.result_path,
                    {
                        "status": "error",
                        "error": f"Unknown mutation type: {mutation.mutation_type}",
                    },
                )
                return None

        result = {"status": "ok", **extra}
        _write_result(mutation.result_path, result)
        logger.info("Mutation complete: %s", mutation.mutation_type)
        return result

    except Exception as exc:
        logger.exception("Mutation failed: %s", mutation.mutation_type)
        _write_result(
            mutation.result_path,
            {"status": "error", "error": str(exc)},
        )
        return None


# ---------------------------------------------------------------------------
# Mutation handlers
# ---------------------------------------------------------------------------


def _execute_reset(hive_dir: Path) -> None:
    """Delete all tasks and session logs.

    Removes the contents of ``tickets/`` and ``logs/`` while preserving
    the directories themselves (so watchers don't lose their handles).
    """
    for subdir_name in ("tickets", "logs", "mutations"):
        subdir = hive_dir / subdir_name
        if not subdir.exists():
            continue

        for child in subdir.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()

        logger.info("Cleared %s/", subdir_name)


def _execute_respond(hive_dir: Path, mutation: PendingMutation) -> None:
    """Write response and flip assignee atomically.

    Both writes happen before the scheduler is triggered, so the
    scheduler never sees a metadata flip without a response file.
    """
    task_id = mutation.data.get("task_id")
    response = mutation.data.get("response")

    if not task_id:
        raise ValueError("respond-to-task mutation missing 'task_id'")
    if response is None:
        raise ValueError("respond-to-task mutation missing 'response'")

    store = TaskStore(hive_dir)
    store.respond(task_id, response)
    logger.info("Response written for task %s", task_id[:8])


def _execute_create_group(hive_dir: Path, mutation: PendingMutation) -> dict[str, Any]:
    """Create multiple tasks with intra-batch dependency resolution.

    Tasks are created sequentially.  Each task may include a ``ref``
    name and a ``depends_on`` list of refs.  Refs are resolved to real
    task IDs within the batch.

    Returns ``{"created": {"ref": "task-id", ...}}`` for the result file.
    """
    tasks = mutation.data.get("tasks")
    if not tasks or not isinstance(tasks, list):
        raise ValueError("create-task-group mutation missing 'tasks' array")

    store = TaskStore(hive_dir)
    ref_to_id: dict[str, str] = {}

    for task_spec in tasks:
        ref = task_spec.get("ref")
        depends_on_refs = task_spec.get("depends_on", [])

        # Resolve ref-based dependencies to real task IDs.
        resolved_deps: list[str] | None = None
        if depends_on_refs:
            resolved_deps = []
            for dep_ref in depends_on_refs:
                dep_id = ref_to_id.get(dep_ref)
                if not dep_id:
                    raise ValueError(
                        f"Unresolved dependency ref '{dep_ref}' in task "
                        f"'{ref or '(unnamed)'}'. Refs must reference "
                        f"earlier tasks in the group."
                    )
                resolved_deps.append(dep_id)

        # Create the task — if it has resolved deps, it starts blocked.
        task = store.create(
            objective=task_spec.get("objective", ""),
            title=task_spec.get("title"),
            playbook_id=task_spec.get("playbook_id"),
            tags=task_spec.get("tags"),
            functions=task_spec.get("functions"),
            skills=task_spec.get("skills"),
            tasks=task_spec.get("tasks"),
            model=task_spec.get("model"),
            context=task_spec.get("context"),
            watch_events=task_spec.get("watch_events"),
            kind=task_spec.get("kind", "work"),
        )

        # Override dependency state if ref-based deps were specified.
        if resolved_deps:
            task.metadata.depends_on = resolved_deps
            task.metadata.status = "blocked"
            store.save_metadata(task)

        if ref:
            ref_to_id[ref] = task.id

        logger.info(
            "Created task %s%s",
            task.id[:8],
            f" (ref={ref})" if ref else "",
        )

    return {"created": ref_to_id}


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

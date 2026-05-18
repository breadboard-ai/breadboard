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

Some hot mutations (``pause-all``) need runtime access to cancel
in-flight asyncio tasks.  The ``MutationManager`` holds a ``Bees``
reference for this purpose.

Supported mutation types:

- **reset** (cold) — Deletes all tasks and session logs.
- **respond-to-task** (hot) — Writes ``response.json`` and flips
  ``assignee`` to ``"agent"`` atomically.
- **create-task-group** (hot) — Creates multiple tasks with
  intra-batch dependency resolution via named refs.
- **cancel-all** (hot) — Cancels all in-flight tasks and flips
  non-terminal statuses to ``paused``.
- **resume-paused** (hot) — Flips all ``paused`` tasks back
  to their pre-pause status.
- **pause-task** (hot) — Pauses a single task by ID.
- **resume-task** (hot) — Resumes a single paused task by ID.
- **delete-task** (hot) — Deletes a task and all its descendants,
  including ticket directories and session logs.
"""

from __future__ import annotations

import json
import logging
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

from bees.unified_agent_store import UnifiedAgentStore

if TYPE_CHECKING:
    from bees.bees import Bees

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


# Name of the sentinel file that indicates the box is actively listening.
BOX_ACTIVE_SENTINEL = ".box-active"


class MutationManager:
    """Processes mutation files from the hive's ``mutations/`` directory.

    Holds an optional ``Bees`` reference for hot mutations that need
    runtime access (e.g., cancelling asyncio tasks).  When no ``Bees``
    instance is available (startup processing), handlers fall back to
    direct filesystem operations via ``TaskStore``.
    """

    def __init__(self, hive_dir: Path, bees: Bees | None = None):
        self._hive_dir = hive_dir
        self._bees = bees

    # -- Sentinel lifecycle ------------------------------------------------

    def activate(self) -> None:
        """Write the box-active sentinel file.

        Called when the box starts listening for mutations.  The hivetool
        checks for this file to decide whether to show mutation-powered UI.
        """
        sentinel = self._mutations_dir / BOX_ACTIVE_SENTINEL
        sentinel.parent.mkdir(parents=True, exist_ok=True)
        sentinel.write_text(f"pid={__import__('os').getpid()}\n")
        logger.info("Box sentinel written: %s", sentinel)

    def deactivate(self) -> None:
        """Remove the box-active sentinel file.

        Called when the box shuts down.
        """
        sentinel = self._mutations_dir / BOX_ACTIVE_SENTINEL
        try:
            sentinel.unlink(missing_ok=True)
            logger.info("Box sentinel removed")
        except OSError:
            logger.warning("Could not remove box sentinel")

    @property
    def _mutations_dir(self) -> Path:
        return self._hive_dir / "mutations"

    # -- Public API --------------------------------------------------------

    async def process_all(self) -> bool:
        """Process all pending mutations (startup).

        Handles both hot and cold mutations.  Used when the box starts
        and no Bees instance is running yet.

        Returns ``True`` if any mutations were processed.
        """
        pending = self._scan_pending()
        if not pending:
            return False

        for mutation in pending:
            logger.info(
                "Processing mutation: %s (%s)",
                mutation.mutation_type, mutation.path.name,
            )
            await self._dispatch(mutation)

        return True

    async def process_inline(self) -> MutationOutcome:
        """Process hot mutations inline while the scheduler is running.

        Cold mutations are not processed — they're flagged in the outcome
        so the caller can initiate a shutdown/restart cycle.

        Returns a ``MutationOutcome`` indicating what happened.
        """
        pending = self._scan_pending()
        outcome = MutationOutcome()

        for mutation in pending:
            if mutation.is_cold:
                outcome.cold_pending = True
                continue

            logger.info(
                "Processing hot mutation: %s (%s)",
                mutation.mutation_type, mutation.path.name,
            )
            result = await self._dispatch(mutation)
            if result:
                outcome.hot_processed += 1
                if result.get("created"):
                    outcome.created_tasks.update(result["created"])

        return outcome

    async def process_cold(self) -> bool:
        """Process cold mutations only (requires quiescent state).

        Called in the gap between Bees shutdown and restart.
        Returns ``True`` if any cold mutations were processed.
        """
        pending = self._scan_pending()
        processed = False

        for mutation in pending:
            if not mutation.is_cold:
                continue

            logger.info(
                "Processing cold mutation: %s (%s)",
                mutation.mutation_type, mutation.path.name,
            )
            await self._dispatch(mutation)
            processed = True

        return processed

    # -- Scanning ----------------------------------------------------------

    def _scan_pending(self) -> list[PendingMutation]:
        """Find mutation files without a matching result file.

        Returns mutations sorted by filename (effectively by creation
        time if UUIDs are used, though ordering is best-effort).
        """
        mutations_dir = self._hive_dir / "mutations"
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
                logger.warning(
                    "Skipping malformed mutation %s: missing 'type'", path.name,
                )
                self._write_result(
                    result_path,
                    {"status": "error", "error": "Malformed mutation: missing 'type'"},
                )
                continue

            pending.append(PendingMutation(path=path, data=data))

        return pending

    # -- Dispatch ----------------------------------------------------------

    async def _dispatch(self, mutation: PendingMutation) -> dict[str, Any] | None:
        """Dispatch a mutation by type and write the result.

        Returns extra result data on success (e.g., created task IDs),
        or ``None`` on failure.
        """
        try:
            extra: dict[str, Any] = {}

            match mutation.mutation_type:
                case "reset":
                    self._handle_reset()
                case "respond-to-task":
                    self._handle_respond(mutation)
                case "create-task-group":
                    extra = self._handle_create_group(mutation)
                case "cancel-all" | "pause-all":
                    extra = self._handle_pause_all()
                case "resume-cancelled" | "resume-paused":
                    extra = self._handle_resume_paused()
                case "pause-task":
                    extra = self._handle_pause_task(mutation)
                case "resume-task":
                    extra = self._handle_resume_task(mutation)
                case "delete-task":
                    extra = self._handle_delete_task(mutation)
                case "rollback-to-turn":
                    extra = await self._handle_rollback_to_turn(mutation)
                case _:
                    self._write_result(
                        mutation.result_path,
                        {
                            "status": "error",
                            "error": f"Unknown mutation type: {mutation.mutation_type}",
                        },
                    )
                    return None

            result = {"status": "ok", **extra}
            self._write_result(mutation.result_path, result)
            logger.info("Mutation complete: %s", mutation.mutation_type)
            return result

        except Exception as exc:
            logger.exception("Mutation failed: %s", mutation.mutation_type)
            self._write_result(
                mutation.result_path,
                {"status": "error", "error": str(exc)},
            )
            return None

    # -- Handlers ----------------------------------------------------------

    def _handle_reset(self) -> None:
        """Delete all tasks and session logs.

        Removes the contents of entity directories (``agents/``,
        ``tasks/``, ``tickets/``), ``logs/``, and ``mutations/``
        while preserving the directories themselves (so watchers
        don't lose their handles).
        """
        # Phase 6: remove "tickets" from this list
        for subdir_name in ("tickets", "agents", "tasks", "logs", "mutations"):
            subdir = self._hive_dir / subdir_name
            if not subdir.exists():
                continue

            for child in subdir.iterdir():
                # Preserve the box-active sentinel — the box is still
                # running, and removing it would signal hivetool that
                # the box has stopped.
                if child.name == BOX_ACTIVE_SENTINEL:
                    continue
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()

            logger.info("Cleared %s/", subdir_name)

    def _handle_respond(self, mutation: PendingMutation) -> None:
        """Write response and flip assignee atomically.

        Uses ``TaskNode.respond()`` when a Bees instance is available,
        falling back to ``TaskStore.respond()`` at startup.
        """
        task_id = mutation.data.get("task_id")
        response = mutation.data.get("response")

        if not task_id:
            raise ValueError("respond-to-task mutation missing 'task_id'")
        if response is None:
            raise ValueError("respond-to-task mutation missing 'response'")

        if self._bees:
            node = self._bees.get_by_id(task_id)
            if not node:
                raise ValueError(f"Task {task_id[:8]} not found")
            node.respond(response)
        else:
            store = UnifiedAgentStore(self._hive_dir)
            store.respond(task_id, response)

        logger.info("Response written for task %s", task_id[:8])

    def _handle_create_group(
        self, mutation: PendingMutation,
    ) -> dict[str, Any]:
        """Create multiple tasks with intra-batch dependency resolution.

        Tasks are created sequentially.  Each task may include a ``ref``
        name and a ``depends_on`` list of refs.  Refs are resolved to
        real task IDs within the batch.

        Returns ``{"created": {"ref": "task-id", ...}}``.
        """
        tasks = mutation.data.get("tasks")
        if not tasks or not isinstance(tasks, list):
            raise ValueError("create-task-group mutation missing 'tasks' array")

        store = UnifiedAgentStore(self._hive_dir)
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

            # Create the agent — if it has resolved deps, it starts blocked.
            agent = store.create(
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
                agent.metadata.depends_on = resolved_deps
                agent.metadata.status = "blocked"
                store.save_metadata(agent)

            if ref:
                ref_to_id[ref] = agent.id

            logger.info(
                "Created agent %s%s",
                agent.id[:8],
                f" (ref={ref})" if ref else "",
            )

        return {"created": ref_to_id}

    def _handle_pause_all(self) -> dict[str, Any]:
        """Pause all non-terminal tasks.

        Delegates to ``Bees.pause_all()`` when available, falls back
        to direct filesystem operations at startup.
        """
        if self._bees:
            count = self._bees.pause_all()
        else:
            store = UnifiedAgentStore(self._hive_dir)
            count = 0
            for status in ("available", "blocked", "running", "suspended"):
                for agent in store.query_all(status=status):
                    agent.metadata.paused_from = agent.metadata.status
                    agent.metadata.status = "paused"
                    store.save_metadata(agent)
                    count += 1

        logger.info("Paused %d task(s)", count)
        return {"paused": count}

    def _handle_resume_paused(self) -> dict[str, Any]:
        """Flip all paused tasks back to their pre-pause status."""
        if self._bees:
            count = self._bees.resume_all()
        else:
            store = UnifiedAgentStore(self._hive_dir)
            paused = store.query_all(status="paused")
            for agent in paused:
                agent.metadata.status = agent.metadata.paused_from or "available"
                agent.metadata.paused_from = None
                store.save_metadata(agent)
            count = len(paused)

        logger.info("Resumed %d paused task(s)", count)
        return {"resumed": count}

    def _handle_pause_task(self, mutation: PendingMutation) -> dict[str, Any]:
        """Pause a single task by ID."""
        task_id = mutation.data.get("task_id")
        if not task_id:
            raise ValueError("pause-task mutation missing 'task_id'")

        if self._bees:
            node = self._bees.get_by_id(task_id)
            paused = node.pause() if node else False
        else:
            store = UnifiedAgentStore(self._hive_dir)
            agent = store.get(task_id)
            if not agent or agent.metadata.status in (
                "completed", "failed", "cancelled", "paused",
            ):
                paused = False
            else:
                agent.metadata.paused_from = agent.metadata.status
                agent.metadata.status = "paused"
                store.save_metadata(agent)
                paused = True

        if paused:
            logger.info("Paused task %s", task_id[:8])
        else:
            logger.warning("Could not pause task %s", task_id[:8])

        return {"paused": paused}

    def _handle_resume_task(self, mutation: PendingMutation) -> dict[str, Any]:
        """Resume a single paused task by ID."""
        task_id = mutation.data.get("task_id")
        if not task_id:
            raise ValueError("resume-task mutation missing 'task_id'")

        if self._bees:
            node = self._bees.get_by_id(task_id)
            resumed = node.resume() if node else False
        else:
            store = UnifiedAgentStore(self._hive_dir)
            agent = store.get(task_id)
            if not agent or agent.metadata.status != "paused":
                logger.warning(
                    "Could not resume task %s (not paused)", task_id[:8],
                )
                return {"resumed": False}
            agent.metadata.status = agent.metadata.paused_from or "available"
            agent.metadata.paused_from = None
            store.save_metadata(agent)
            resumed = True

        if resumed:
            logger.info("Resumed task %s", task_id[:8])
        else:
            logger.warning(
                "Could not resume task %s (not paused)", task_id[:8],
            )

        return {"resumed": resumed}

    def _handle_delete_task(self, mutation: PendingMutation) -> dict[str, Any]:
        """Delete a task and all its descendants.

        Delegates to ``Bees.delete_task()`` when available (cancels
        in-flight asyncio tasks, marks deleted IDs so post-completion
        cleanup is skipped).  Falls back to filesystem-only deletion
        via ``TaskStore`` at startup.
        """
        task_id = mutation.data.get("task_id")
        if not task_id:
            raise ValueError("delete-task mutation missing 'task_id'")

        if self._bees:
            deleted = self._bees.delete_task(task_id)
        else:
            deleted = self._delete_task_filesystem(task_id)

        logger.info(
            "Deleted %d task(s): %s",
            len(deleted),
            ", ".join(tid[:8] for tid in deleted),
        )
        return {"deleted": deleted}

    def _delete_task_filesystem(self, task_id: str) -> list[str]:
        """Delete a task tree using only filesystem operations.

        Used at startup when no Bees instance is running.
        """
        store = UnifiedAgentStore(self._hive_dir)
        deleted: list[str] = []
        self._delete_fs_recursive(task_id, store, deleted)
        return deleted

    def _delete_fs_recursive(
        self, task_id: str, store: UnifiedAgentStore, deleted: list[str],
    ) -> None:
        """Recursively delete a task and its children from disk."""
        # Recurse into children first.
        children = store.get_children(task_id)
        for child in children:
            self._delete_fs_recursive(child.id, store, deleted)

        # Remove entity directory.
        entity_dir = store.entity_dir(task_id)
        if entity_dir.exists():
            shutil.rmtree(entity_dir)

        # Remove matching session logs.
        logs_dir = self._hive_dir / "logs"
        if logs_dir.exists():
            prefix = f"bees-{task_id[:8]}-"
            for log_file in logs_dir.iterdir():
                if log_file.name.startswith(prefix):
                    log_file.unlink(missing_ok=True)

        deleted.append(task_id)
        logger.info("Deleted task %s", task_id[:8])

    async def _handle_rollback_to_turn(self, mutation: PendingMutation) -> dict[str, Any]:
        """Fork a session at a prior turn boundary."""
        from opal_backend.sessions.file_store import FileBasedSessionStore
        from opal_backend.interaction_store import InteractionState
        from bees.disk_file_system import DiskFileSystem
        from opal_backend.chat_log_manager import derive_chat_log

        task_id = mutation.data.get("task_id")
        turn_index = mutation.data.get("turn_index")
        session_id = mutation.data.get("session_id")
        if not task_id:
            raise ValueError("rollback-to-turn mutation missing 'task_id'")
        if turn_index is None:
            raise ValueError("rollback-to-turn mutation missing 'turn_index'")

        store = UnifiedAgentStore(self._hive_dir)
        agent = store.get(task_id)
        if not agent:
            raise ValueError(f"Task {task_id} not found")

        # 0. Guard: reject if metadata.status != "suspended".
        if agent.metadata.status != "suspended":
            raise ValueError(
                f"Cannot rollback task {task_id} because its status is "
                f"'{agent.metadata.status}', not 'suspended'"
            )

        active_session = agent.metadata.active_session
        fork_source_session = session_id or active_session
        if not fork_source_session:
            raise ValueError(f"Task {task_id} has no session to fork from")

        session_store = FileBasedSessionStore(agent.dir / "sessions")

        # 1. Load the target session's InteractionState from the store.
        sdir = session_store._session_dir(fork_source_session)
        int_file = sdir / "interaction.json"
        if not int_file.exists():
            raise ValueError(f"Active session interaction file not found: {int_file}")
        
        int_data = json.loads(int_file.read_text(encoding="utf-8"))
        interaction_state = InteractionState.from_dict(int_data)

        # 2. Load turn boundaries and filesystem snapshots from the store.
        checkpoints = await session_store.get_turn_boundaries(fork_source_session)
        if not checkpoints:
            raise ValueError(f"No turn checkpoints found for session {fork_source_session}")
        
        if turn_index < 0 or turn_index >= len(checkpoints):
            raise ValueError(f"Invalid turn_index {turn_index} (total checkpoints: {len(checkpoints)})")

        target_checkpoint = checkpoints[turn_index]
        context_length = target_checkpoint["context_length"]

        # Find the nearest non-null file system snapshot by walking backward from turn_index
        fs_snapshot = None
        for idx in range(turn_index, -1, -1):
            cp = checkpoints[idx]
            if cp.get("file_system") is not None:
                fs_snapshot = cp["file_system"]
                break

        # 3. Generate a new session UUID. Create its directory under tickets/{id}/sessions/.
        import uuid as uuid_lib
        new_session_id = str(uuid_lib.uuid4())
        new_sdir = agent.dir / "sessions" / new_session_id
        new_sdir.mkdir(parents=True, exist_ok=True)

        # 4. Copy interaction_state.contents[:turn_boundaries[turn_index]] into the new session's InteractionState.
        new_contents = interaction_state.contents[:context_length]

        # 5. Copy the file_system snapshot from the fork-point turn boundary.
        # 6. Clear function_call_part in the new session (no pending suspend).
        new_state = InteractionState(
            session_id=new_session_id,
            contents=new_contents,
            file_system=fs_snapshot,
            function_call_part={},
            task_tree=interaction_state.task_tree,
            consents_granted=interaction_state.consents_granted,
            flags=interaction_state.flags,
            graph=interaction_state.graph,
            model=interaction_state.model,
            completed_function_responses=[],
            is_precondition_check=False,
        )

        # Save the new interaction state and set a dummy resume_id to enable loading
        await session_store.save_interaction(new_session_id, new_state)
        await session_store.set_resume_id(new_session_id, "fork-resume-id")

        # Also copy turns.json up to turn_index
        turns_file = sdir / "turns.json"
        if turns_file.exists():
            try:
                turns_data = json.loads(turns_file.read_text(encoding="utf-8"))
                new_turns = turns_data[:turn_index]
                new_turns_file = new_sdir / "turns.json"
                new_turns_file.write_text(json.dumps(new_turns, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception as e:
                logger.warning("Failed to copy turns.json on fork: %s", e)

        # Also copy and slice events.jsonl up to turn_index
        events_file = sdir / "events.jsonl"
        if events_file.exists():
            try:
                lines = events_file.read_text(encoding="utf-8").splitlines()
                keep_lines = []
                send_request_count = 0
                for line in lines:
                    if not line.strip():
                        continue
                    event_obj = json.loads(line)
                    if "sendRequest" in event_obj:
                        if send_request_count == turn_index:
                            break
                        send_request_count += 1
                    keep_lines.append(line)
                
                new_events_file = new_sdir / "events.jsonl"
                new_events_file.write_text("\n".join(keep_lines) + "\n", encoding="utf-8")
            except Exception as e:
                logger.warning("Failed to slice events.jsonl on fork: %s", e)

        # 7. Write lineage.json for both sessions (fork point + parent/child).
        old_lineage = {}
        old_lineage_file = sdir / "lineage.json"
        if old_lineage_file.exists():
            try:
                old_lineage = json.loads(old_lineage_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        
        old_lineage["forked_to"] = {"session": new_session_id, "at_turn": turn_index}
        old_lineage_file.write_text(json.dumps(old_lineage, ensure_ascii=False, indent=2), encoding="utf-8")

        new_lineage = {"forked_from": {"session": fork_source_session, "at_turn": turn_index}}
        new_lineage_file = new_sdir / "lineage.json"
        new_lineage_file.write_text(json.dumps(new_lineage, ensure_ascii=False, indent=2), encoding="utf-8")

        # 8. Mark currently active session status as SUPERSEDED.
        if active_session:
            await session_store.set_status(active_session, "superseded")

        # 9. Update task metadata: active_session → new session ID.
        # 10. Reset task metadata: status → available, clear suspend_event, adjust turns count, clear assignee.
        agent.metadata.active_session = new_session_id
        agent.metadata.status = "available"
        agent.metadata.suspend_event = None
        agent.metadata.turns = turn_index
        agent.metadata.assignee = None
        agent.metadata.error = None
        agent.metadata.completed_at = None
        store.save_metadata(agent)

        # 11. Hydrate the runtime DiskFileSystem from the fork-point snapshot.
        new_ws = agent.fs_dir
        new_ws.mkdir(parents=True, exist_ok=True)
        if fs_snapshot is not None:
            dfs = DiskFileSystem(new_ws)
            dfs.hydrate_from_snapshot(fs_snapshot)

        # 12. Trim chat_log.json to match.
        chat_log_path = agent.dir / "chat_log.json"
        if chat_log_path.exists():
            try:
                derived = derive_chat_log(new_contents)
                trimmed_entries = []
                for entry in derived:
                    role = "agent" if entry["role"] == "model" else "user"
                    parts = entry.get("parts", [])
                    text_parts = [p.get("text", "") for p in parts if "text" in p]
                    trimmed_entries.append({
                        "role": role,
                        "text": "".join(text_parts)
                    })
                chat_log_path.write_text(
                    json.dumps(trimmed_entries, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8"
                )
            except Exception as e:
                logger.warning("Failed to trim chat_log.json: %s", e)

        # 13. Optionally clean up child tasks spawned after the rollback point.
        try:
            new_contents_str = json.dumps(new_contents)
            child_tickets = store.get_children(task_id)
            for child in child_tickets:
                if child.id not in new_contents_str:
                    logger.info("Deleting child task %s spawned after rollback point", child.id[:8])
                    if self._bees:
                        self._bees.delete_task(child.id)
                    else:
                        self._delete_task_filesystem(child.id)
        except Exception as e:
            logger.warning("Failed to clean up child tasks during rollback: %s", e)

        # 14. Re-queue tasks completed after the fork point.
        # Read task_completions.json from the source session to find
        # which tasks were completed at which turns. Tasks completed
        # after turn_index revert to available; pre-fork completions
        # are copied to the new session.
        requeued_tasks: list[str] = []
        try:
            completions_file = sdir / "task_completions.json"
            if completions_file.exists():
                completions = json.loads(
                    completions_file.read_text(encoding="utf-8")
                )

                pre_fork: list[dict[str, Any]] = []
                for entry in completions:
                    if entry.get("turn", 0) > turn_index:
                        # Revert this task to available.
                        task_record = store._task_file_store.get(
                            entry["task_id"]
                        )
                        if task_record and task_record.status == "completed":
                            task_record.status = "available"
                            task_record.outcome = None
                            task_record.outcome_content = None
                            task_record.completed_at = None
                            store._task_file_store.save(task_record)
                            requeued_tasks.append(entry["task_id"])
                            logger.info(
                                "Re-queued task %s (completed at turn %d)",
                                entry["task_id"][:8],
                                entry.get("turn", -1),
                            )
                    else:
                        pre_fork.append(entry)

                # Copy pre-fork completions to the new session.
                if pre_fork:
                    new_completions_file = new_sdir / "task_completions.json"
                    new_completions_file.write_text(
                        json.dumps(
                            pre_fork, indent=2, ensure_ascii=False
                        ) + "\n",
                        encoding="utf-8",
                    )
        except Exception as e:
            logger.warning("Failed to re-queue tasks during rollback: %s", e)

        # 15. Buffer re-queued tasks as pending context updates so the
        # agent receives them on resume — mirrors how agents_assign_task
        # delivers tasks via scheduler.deliver_to_task.
        if requeued_tasks and store.layout == "swarm":
            pending = agent.metadata.pending_context_updates or []
            for task_id in requeued_tasks:
                task_record = store._task_file_store.get(task_id)
                if task_record:
                    pending.append({
                        "type": "task_assigned",
                        "objective": task_record.objective,
                    })
            agent.metadata.pending_context_updates = pending
            store.save_metadata(agent)

        result: dict[str, Any] = {}
        if requeued_tasks:
            result["requeued_tasks"] = requeued_tasks
            logger.info(
                "Rollback re-queued %d task(s): %s",
                len(requeued_tasks),
                ", ".join(tid[:8] for tid in requeued_tasks),
            )
        return result


    # -- Utilities ---------------------------------------------------------

    @staticmethod
    def _write_result(result_path: Path, result: dict[str, Any]) -> None:
        """Write a mutation result file."""
        result["timestamp"] = datetime.now(timezone.utc).isoformat()
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(
            json.dumps(result, indent=2, ensure_ascii=False) + "\n"
        )

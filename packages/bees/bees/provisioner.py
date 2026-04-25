# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Session provisioning — assemble everything a session runner needs.

Extracts the provisioning logic from ``session.py`` into a standalone
function.  Provisioning is pure bees-framework logic with no
``opal_backend`` dependencies: filter skills, create the file system,
assemble function groups, and package the result as a
``SessionConfiguration``.

The execution step (calling the model, draining events) stays in the
session runner.
"""

from __future__ import annotations

__all__ = ["provision_session"]

import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from bees.disk_file_system import DiskFileSystem
from bees.functions.chat import get_chat_function_group_factory
from bees.functions.events import get_events_function_group_factory
from bees.functions.live import get_live_function_group
from bees.functions.sandbox import get_sandbox_function_group_factory
from bees.functions.simple_files import get_simple_files_function_group_factory
from bees.functions.skills import get_skills_function_group
from bees.functions.system import get_system_function_group_factory
from bees.functions.tasks import get_tasks_function_group_factory
from bees.protocols.session import SessionConfiguration
from bees.skill_filter import filter_skills, merge_function_filter
from bees.subagent_scope import SubagentScope


def provision_session(
    *,
    segments: list[dict[str, Any]],
    ticket_id: str | None = None,
    ticket_dir: Path | None = None,
    fs_dir: Path | None = None,
    function_filter: list[str] | None = None,
    allowed_skills: list[str] | None = None,
    model: str | None = None,
    on_events_broadcast: Any | None = None,
    deliver_to_parent: Any | None = None,
    scope: SubagentScope | None = None,
    scheduler: Any | None = None,
    hive_dir: Path | None = None,
    mcp_factories: list | None = None,
    on_chat_entry: Callable[[str, str], None] | None = None,
    seed_files: bool = True,
) -> SessionConfiguration:
    """Assemble everything a session runner needs from task parameters.

    This function performs the provisioning half of what ``run_session``
    does: resolving the hive, filtering skills, creating the file system,
    assembling function group factories, and producing a log path.  The
    execution half (calling the model, draining events) stays in the
    runner.

    Args:
        segments: Input segments for the session.
        ticket_id: Unique task identifier.
        ticket_dir: Path to the task's directory on disk.
        fs_dir: Override for the file system working directory.
        function_filter: Optional allowlist of function names.
        allowed_skills: Skill names to enable.
        model: Model identifier override.
        on_events_broadcast: Callback for event broadcasting.
        deliver_to_parent: Callback for parent event delivery.
        scope: Subagent scope for file system isolation.
        scheduler: Reference to the scheduler (for task/event functions).
        hive_dir: Root of the hive directory.
        mcp_factories: Additional MCP function group factories.
        on_chat_entry: Callback for chat log entries.
        seed_files: Whether to seed skill files into the file system.
            Set to ``False`` for resume (files already on disk).
    """
    # 1. Resolve hive directory.
    if hive_dir is None:
        if ticket_dir:
            hive_dir = ticket_dir.parent.parent
        else:
            from bees.config import HIVE_DIR

            hive_dir = HIVE_DIR

    # 2. Filter skills and merge function filter.
    session_listing, session_files, skill_tools = filter_skills(
        allowed_skills, hive_dir
    )

    function_filter = merge_function_filter(
        function_filter, skill_tools, allowed_skills,
    )

    # 3. Create disk-backed file system.
    work_dir = fs_dir or (
        ticket_dir / "filesystem" if ticket_dir
        else Path(tempfile.mkdtemp(prefix="bees-fs-"))
    )
    disk_fs = DiskFileSystem(work_dir)

    # 4. Seed initial files (skills) directly to disk.
    if seed_files:
        for name, content in session_files.items():
            disk_fs.write(name, content)

    # 5. Assemble function group factories.
    workspace_root_id = scope.workspace_root_id if scope else None

    function_groups = [
        get_system_function_group_factory(),
        get_live_function_group(),
        get_simple_files_function_group_factory(scope=scope),
        get_skills_function_group(available_skills=session_listing),
        get_sandbox_function_group_factory(
            work_dir=work_dir,
            scope=scope,
        ),
        get_events_function_group_factory(
            on_events_broadcast=on_events_broadcast,
            deliver_to_parent=deliver_to_parent,
            ticket_id=ticket_id,
            scope=scope,
            scheduler=scheduler,
        ),
        get_tasks_function_group_factory(
            scope=scope,
            caller_ticket_id=ticket_id,
            scheduler=scheduler,
            ticket_id=ticket_id,
        ),
        get_chat_function_group_factory(
            on_chat_entry=on_chat_entry,
            workspace_root_id=workspace_root_id,
            scheduler=scheduler,
        ),
    ] + (mcp_factories or [])

    # 6. Create log path.
    date_stamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    log_prefix = f"bees-{ticket_id[:8]}" if ticket_id else "bees-session"
    out_dir = hive_dir / "logs"
    log_path = out_dir / f"{log_prefix}-{date_stamp}.log.json"

    # 7. Assemble configuration.
    label = ticket_id[:8] if ticket_id else ""

    return SessionConfiguration(
        segments=segments,
        function_groups=function_groups,
        function_filter=function_filter,
        model=model,
        file_system=disk_fs,
        ticket_id=ticket_id,
        ticket_dir=ticket_dir,
        label=label,
        log_path=log_path,
        on_chat_entry=on_chat_entry,
    )

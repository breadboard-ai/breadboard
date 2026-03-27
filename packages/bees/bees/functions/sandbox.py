# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Sandbox function group — generic bash execution.

Gives the agent access to a local bash shell via ``execute_bash``.
The sandbox is intentionally dumb: it knows nothing about bundling,
UI, or any specific tool. Skills teach the agent what to *do* with
bash; this module just provides the capability.

AgentFileSystem sync
--------------------
When an ``AgentFileSystem`` is provided (via the factory pattern or
directly), file writes are kept in sync in both directions:

* **Before** each ``execute_bash`` call: text files in AgentFS are
  materialised onto disk at ``work_dir/mnt/<name>`` so the shell can
  read them directly.
* **After** each ``execute_bash`` call: new or modified files on disk
  are read back into AgentFS so the agent can reference them via
  ``system_list_files`` / pidgin ``<file>`` tags.

Binary files created by bash are ingested as ``inlineData`` parts.
``/mnt/system/`` virtual files are never written to or read from disk.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
import mimetypes
import os
import platform
import shutil
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Any

from opal_backend.function_definition import (
    FunctionGroup,
    FunctionGroupFactory,
    SessionHooks,
    assemble_function_group,
    load_declarations,
)

if TYPE_CHECKING:
    from opal_backend.agent_file_system import AgentFileSystem

__all__ = ["get_sandbox_function_group", "get_sandbox_function_group_factory"]

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SEC = 30
MAX_OUTPUT_BYTES = 64 * 1024  # 64 KB
_BINARY_SNIFF_BYTES = 8 * 1024  # scan first 8 KB for null bytes

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"

_SANDBOX_PROFILE = """\
;; Establishes the strict "deny-by-default" posture. 
;; Absolutely nothing is allowed (no network, no files, no IPC) unless explicitly listed below.
(version 1)
(deny default)

;; Allows the sandbox to actually run commands and spawn child processes.
(allow process-exec)
(allow process-fork)

;; Allows the agent to READ anything on the disk (needed by runtimes like Node to read system frameworks).
(allow file-read*)

;; The most critical part: restricts WRITE access to ONLY these three specific paths.
;; The agent mathematically cannot modify, delete, or overwrite any file anywhere else.
(allow file-write*
  (subpath "{work_dir}")             ;; The isolated ticket directory
  (subpath "/private/tmp")           ;; System tempdir (tools crash without this)
  (subpath "/private/var/folders"))  ;; macOS user-specific temp/cache dirs

;; Allows reading system information (like CPU cores or memory limits) which runtimes use on startup.
(allow sysctl-read)

;; Allows the process to query macOS "Mach services" (for OS things like time-sync, launching processes).
(allow mach-lookup)
"""


# ---------------------------------------------------------------------------
# Sync helpers
# ---------------------------------------------------------------------------

def _is_binary(path: Path) -> bool:
    """Return True if the file looks like non-text binary data.

    Reads the first ``_BINARY_SNIFF_BYTES`` bytes and checks for null bytes,
    which reliably distinguishes text from binary in practice.
    """
    try:
        chunk = path.read_bytes()[:_BINARY_SNIFF_BYTES]
        return b"\x00" in chunk
    except OSError:
        return False


def _content_hash(data: str) -> str:
    """Return a short hash of a string for change detection."""
    return hashlib.md5(data.encode("utf-8"), usedforsecurity=False).hexdigest()


def _sync_agent_fs_to_disk(agent_fs: "AgentFileSystem", work_dir: Path) -> None:
    """Write AgentFileSystem text files to disk before bash runs.

    Each ``/mnt/<name>`` AgentFS entry is written to ``work_dir/<name>``
    (the ``/mnt/`` prefix is stripped), placing files directly in the bash
    working directory so the agent can access them as bare filenames.

    Only text files (``type == "text"``) are written — binary inlineData
    cannot be meaningfully executed by bash.

    Files that already exist on disk with identical content are skipped to
    avoid spurious mtime updates.
    """
    for path, descriptor in agent_fs.files.items():
        # Only sync text files and skip virtual system paths.
        if path.startswith("/mnt/system/"):
            continue
        if descriptor.type != "text":
            continue

        # /mnt/foo.md → work_dir/foo.md  (strip /mnt/ prefix)
        rel = path[len("/mnt/"):]
        disk_path = work_dir / rel
        disk_path.parent.mkdir(parents=True, exist_ok=True)

        # Write only when content differs (avoids mtime churn).
        if disk_path.exists():
            try:
                existing = disk_path.read_text(encoding="utf-8", errors="replace")
                if existing == descriptor.data:
                    continue
            except OSError:
                pass

        try:
            disk_path.write_text(descriptor.data, encoding="utf-8")
        except OSError:
            logger.warning("sandbox: could not write %s to disk", path)


def _sync_disk_to_agent_fs(agent_fs: "AgentFileSystem", work_dir: Path) -> None:
    """Read files created/modified by bash back into AgentFileSystem.

    Walks ``work_dir/`` recursively. For each file found:
    - Derives the ``/mnt/<name>`` AgentFS key (internal representation).
    - Skips ``/mnt/system/`` (virtual only), ``node_modules/``, and
      any hidden directories (names starting with ``.``).
    - For text files: calls ``agent_fs.overwrite()`` if absent or changed.
    - For binary files: calls ``agent_fs.add_part({inlineData: ...})`` only
      if the path is not yet known to AgentFS (binaries are write-once from
      the agent's perspective).

    Internal AgentFS keys remain ``/mnt/``-prefixed; the presentation layer
    (``simple_files.py``) strips the prefix before returning paths to the agent.
    """
    known_files = agent_fs.files

    _SKIP_DIRS = {"node_modules"}

    for disk_path in work_dir.rglob("*"):
        if not disk_path.is_file():
            continue

        # Skip hidden dirs and node_modules anywhere in the path.
        rel = disk_path.relative_to(work_dir)  # e.g. foo.md, build/index.js
        if any(part.startswith(".") or part in _SKIP_DIRS for part in rel.parts):
            continue

        # Internal AgentFS key: /mnt/foo.md, /mnt/build/index.js
        agent_path = f"/mnt/{rel}"

        if agent_path.startswith("/mnt/system/"):
            continue

        if _is_binary(disk_path):
            # Only ingest unknown binary files — never overwrite existing ones.
            if agent_path not in known_files:
                mime_type, _ = mimetypes.guess_type(disk_path.name)
                mime_type = mime_type or "application/octet-stream"
                try:
                    raw = disk_path.read_bytes()
                    data = base64.b64encode(raw).decode("ascii")
                    agent_fs.add_part(
                        {"inlineData": {"data": data, "mimeType": mime_type}},
                        file_name=disk_path.name,
                    )
                except OSError:
                    logger.warning(
                        "sandbox: could not read binary %s", agent_path
                    )
        else:
            # Text file — ingest or update.
            try:
                content = disk_path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                logger.warning("sandbox: could not read %s", agent_path)
                continue

            existing = known_files.get(agent_path)
            if existing is None:
                # New file created by bash — name is relative to work_dir.
                name = str(rel)  # e.g. "foo.md" or "build/index.js"
                agent_fs.overwrite(name, content)
            elif existing.type == "text" and existing.data != content:
                # Bash modified an existing text file — update AgentFS.
                name = str(rel)
                agent_fs.overwrite(name, content)


# ---------------------------------------------------------------------------
# Handler factory
# ---------------------------------------------------------------------------


def _make_handlers(
    *,
    work_dir: Path,
    timeout: int = DEFAULT_TIMEOUT_SEC,
    agent_fs: "AgentFileSystem | None" = None,
) -> dict[str, Any]:
    """Build the handler map for the sandbox function group."""

    async def execute_bash(
        args: dict[str, Any], status_cb: Any
    ) -> dict[str, Any]:
        command = args.get("command", "")
        cmd_timeout = args.get("timeout", timeout)

        if not command:
            return {"error": "command is required"}

        if status_cb:
            preview = command[:80] + ("…" if len(command) > 80 else "")
            status_cb(f"Running: {preview}")

        # Sync AgentFS → disk so bash can read agent-written files.
        if agent_fs is not None:
            _sync_agent_fs_to_disk(agent_fs, work_dir)

        try:
            cmd_parts = ["bash", "-c", command]
            if platform.system() == "Darwin" and shutil.which("sandbox-exec"):
                profile = _SANDBOX_PROFILE.format(work_dir=str(work_dir))
                cmd_parts = ["sandbox-exec", "-p", profile, "--"] + cmd_parts

            proc = await asyncio.create_subprocess_exec(
                *cmd_parts,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(work_dir),
                env={
                    **os.environ,
                    "HOME": str(work_dir),
                },
            )
            stdout, _ = await asyncio.wait_for(
                proc.communicate(), timeout=cmd_timeout
            )
        except asyncio.TimeoutError:
            try:
                proc.kill()
                await proc.wait()
            except ProcessLookupError:
                pass
            return {"error": f"Command timed out after {cmd_timeout}s"}
        except Exception as e:
            logger.exception("execute_bash failed")
            return {"error": str(e)}

        output = stdout.decode("utf-8", errors="replace")

        truncated = False
        if len(output) > MAX_OUTPUT_BYTES:
            output = output[:MAX_OUTPUT_BYTES] + "\n[truncated]"
            truncated = True

        if status_cb:
            status_cb(None, None)

        # Sync disk → AgentFS so the agent can reference bash-created files.
        if agent_fs is not None:
            _sync_disk_to_agent_fs(agent_fs, work_dir)

        result: dict[str, Any] = {
            "stdout": output,
            "exit_code": proc.returncode,
        }
        if truncated:
            result["truncated"] = True
        return result

    return {"execute_bash": execute_bash}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_sandbox_function_group(
    *, work_dir: Path | None = None, timeout: int = DEFAULT_TIMEOUT_SEC,
) -> FunctionGroup:
    """Build a FunctionGroup with the execute_bash function (no sync).

    Use this when no ``AgentFileSystem`` is available (e.g. tests, one-off
    scripts). For full bidirectional sync use
    ``get_sandbox_function_group_factory()``.

    Args:
        work_dir: Persistent working directory for commands. If None,
            a temporary directory is created (and persists for the
            process lifetime).
        timeout: Default timeout in seconds per command.

    Returns:
        A FunctionGroup ready to append to the agent's tool set.
    """
    if work_dir is None:
        work_dir = Path(tempfile.mkdtemp(prefix="bees-sandbox-"))
    work_dir.mkdir(parents=True, exist_ok=True)

    _maybe_symlink_node_modules(work_dir)

    handlers = _make_handlers(work_dir=work_dir, timeout=timeout)
    loaded = load_declarations("sandbox", declarations_dir=_DECLARATIONS_DIR)
    return assemble_function_group(loaded, handlers)


def get_sandbox_function_group_factory(
    *, work_dir: Path | None = None, timeout: int = DEFAULT_TIMEOUT_SEC,
) -> FunctionGroupFactory:
    """Return a late-binding factory for the sandbox FunctionGroup.

    The factory receives ``SessionHooks`` at session-start and wires in the
    session's ``AgentFileSystem`` for bidirectional sync.  Use this in
    ``session.py`` instead of ``get_sandbox_function_group()``.

    The ``work_dir`` is resolved eagerly (before the session starts) so the
    directory is ready when the factory is called.

    Args:
        work_dir: Working directory for bash commands. If None, a temporary
            directory is created.
        timeout: Default timeout in seconds per command.

    Returns:
        A ``FunctionGroupFactory`` callable.
    """
    if work_dir is None:
        work_dir = Path(tempfile.mkdtemp(prefix="bees-sandbox-"))
    work_dir.mkdir(parents=True, exist_ok=True)

    _maybe_symlink_node_modules(work_dir)

    def factory(hooks: SessionHooks) -> FunctionGroup:
        from opal_backend.agent_file_system import AgentFileSystem

        fs: AgentFileSystem | None = hooks.file_system
        handlers = _make_handlers(
            work_dir=work_dir,
            timeout=timeout,
            agent_fs=fs,
        )
        loaded = load_declarations("sandbox", declarations_dir=_DECLARATIONS_DIR)
        return assemble_function_group(loaded, handlers)

    return factory


def _maybe_symlink_node_modules(work_dir: Path) -> None:
    """Symlink sandbox-local node_modules into work_dir if present."""
    sandbox_node_modules = Path(__file__).resolve().parent / "node_modules"
    if sandbox_node_modules.exists():
        target = work_dir / "node_modules"
        if not target.exists():
            try:
                os.symlink(str(sandbox_node_modules), str(target))
            except OSError:
                pass  # Concurrent execution or already linked.

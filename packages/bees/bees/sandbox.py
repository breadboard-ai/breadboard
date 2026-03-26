# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Sandbox function group — generic bash execution.

Gives the agent access to a local bash shell via ``execute_bash``.
The sandbox is intentionally dumb: it knows nothing about bundling,
UI, or any specific tool. Skills teach the agent what to *do* with
bash; this module just provides the capability.
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import shutil
import tempfile
from pathlib import Path
from typing import Any

from opal_backend.function_definition import (
    FunctionGroup,
    assemble_function_group,
    load_declarations,
)

__all__ = ["get_sandbox_function_group"]

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SEC = 30
MAX_OUTPUT_BYTES = 64 * 1024  # 64 KB

_DECLARATIONS_DIR = Path(__file__).resolve().parent / "declarations"

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


def _make_handlers(
    *, work_dir: Path, timeout: int = DEFAULT_TIMEOUT_SEC,
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

        result: dict[str, Any] = {
            "stdout": output,
            "exit_code": proc.returncode,
        }
        if truncated:
            result["truncated"] = True
        return result

    return {"execute_bash": execute_bash}


def get_sandbox_function_group(
    *, work_dir: Path | None = None, timeout: int = DEFAULT_TIMEOUT_SEC,
) -> FunctionGroup:
    """Build a FunctionGroup with the execute_bash function.

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

    # Symlink sandbox-local node_modules into the work dir so Node resolves them natively
    sandbox_node_modules = Path(__file__).resolve().parent / "node_modules"
    if sandbox_node_modules.exists():
        try:
            os.symlink(str(sandbox_node_modules), str(work_dir / "node_modules"))
        except OSError:
            pass  # Fallback or concurrent execution safety

    handlers = _make_handlers(work_dir=work_dir, timeout=timeout)
    loaded = load_declarations("sandbox", declarations_dir=_DECLARATIONS_DIR)
    return assemble_function_group(loaded, handlers)

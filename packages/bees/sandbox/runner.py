# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Sandbox — isolated command execution.

Runs commands inside macOS sandbox-exec (deny-by-default profile)
or falls back to direct execution on unsupported platforms.

The primary use case is esbuild bundling of agent-generated JSX,
but the interface is general-purpose.
"""

from __future__ import annotations

import json
import logging
import platform
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

__all__ = ["run", "SandboxResult"]

logger = logging.getLogger(__name__)


# Deny-by-default sandbox profile for macOS.
_SANDBOX_PROFILE = """\
(version 1)
(deny default)
(allow process-exec)
(allow process-fork)
(allow file-read*)
(allow file-write*
  (subpath "{work_dir}")
  (subpath "/private/tmp")
  (subpath "/private/var/folders"))
(allow sysctl-read)
(allow mach-lookup)
"""


@dataclass
class SandboxResult:
    """Result of a sandboxed command execution."""

    exit_code: int
    stdout: str
    stderr: str
    output_files: dict[str, str] = field(default_factory=dict)


def run(
    command: list[str],
    *,
    input_files: dict[str, str] | None = None,
    timeout: int = 30,
    cwd: Path | None = None,
) -> SandboxResult:
    """Run a command in sandbox isolation.

    Args:
        command: Command and arguments to execute.
        input_files: Files to write into the working directory before
            execution. Keys are relative paths, values are content.
        timeout: Maximum execution time in seconds.
        cwd: Working directory. If None, a temp dir is created.

    Returns:
        SandboxResult with exit code, stdout, stderr, and any output
        files found in the working directory after execution.
    """
    managed_dir = cwd is None
    work_dir = Path(tempfile.mkdtemp(prefix="bees-sandbox-")) if managed_dir else cwd

    try:
        # Write input files.
        if input_files:
            for rel_path, content in input_files.items():
                file_path = work_dir / rel_path
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(content, encoding="utf-8")

        # Build the sandboxed command.
        full_command = _wrap_with_sandbox(command, work_dir)

        # Symlink sandbox-local node_modules into the work dir so Node resolves them natively
        import os
        sandbox_node_modules = Path(__file__).resolve().parent / "node_modules"
        if sandbox_node_modules.exists():
            try:
                os.symlink(str(sandbox_node_modules), str(work_dir / "node_modules"))
            except OSError:
                pass  # Fallback or concurrent execution safety

        logger.info("Sandbox exec: %s", " ".join(full_command))
        proc = subprocess.run(
            full_command,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(work_dir),
        )

        # Collect output files (anything new in the work dir).
        output_files: dict[str, str] = {}
        if input_files is not None:
            input_names = set(input_files.keys())
            for path in work_dir.rglob("*"):
                if path.is_file():
                    rel = str(path.relative_to(work_dir))
                    if rel not in input_names and not rel.startswith("node_modules"):
                        try:
                            output_files[rel] = path.read_text(encoding="utf-8")
                        except UnicodeDecodeError:
                            pass  # Skip binary files.

        return SandboxResult(
            exit_code=proc.returncode,
            stdout=proc.stdout,
            stderr=proc.stderr,
            output_files=output_files,
        )

    except subprocess.TimeoutExpired:
        return SandboxResult(
            exit_code=-1,
            stdout="",
            stderr=f"Command timed out after {timeout}s",
        )

    finally:
        if managed_dir:
            shutil.rmtree(work_dir, ignore_errors=True)


def _wrap_with_sandbox(
    command: list[str],
    work_dir: Path,
) -> list[str]:
    """Wrap a command with sandbox-exec on macOS, passthrough elsewhere."""
    if platform.system() != "Darwin":
        return command

    sandbox_exec = shutil.which("sandbox-exec")
    if not sandbox_exec:
        logger.warning("sandbox-exec not found, running without isolation")
        return command

    profile = _SANDBOX_PROFILE.format(work_dir=str(work_dir))
    return [sandbox_exec, "-p", profile, "--"] + command

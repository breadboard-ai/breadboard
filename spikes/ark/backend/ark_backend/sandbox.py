"""DangerousSandbox — run bash commands on the local server.

This function group gives the skilled agent the ability to execute arbitrary
shell commands. It lives entirely within the ark spike and is NOT part of
opal-backend.

⚠️  The name is intentional — this runs with the full privileges of the
server process. Use only in local spike environments.
"""

from __future__ import annotations

import asyncio
import logging
import os
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

# Limits.
DEFAULT_TIMEOUT_SEC = 30
MAX_OUTPUT_BYTES = 64 * 1024  # 64 KB

_DECLARATIONS_DIR = Path(__file__).resolve().parent.parent / "declarations"


def _make_handlers(
    *, work_dir: Path, timeout: int = DEFAULT_TIMEOUT_SEC,
    extra_env: dict[str, str] | None = None,
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
            # Truncate for display so the agent's long one-liners don't
            # flood the progress UI.
            preview = command[:80] + ("…" if len(command) > 80 else "")
            status_cb(f"Running: {preview}")

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(work_dir),
                env={
                    "HOME": str(work_dir),
                    "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
                    "LANG": "en_US.UTF-8",
                },
            )
            stdout, _ = await asyncio.wait_for(
                proc.communicate(), timeout=cmd_timeout
            )
        except asyncio.TimeoutError:
            # SIGTERM was sent by wait_for; give it a moment then SIGKILL.
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

        # Truncate oversized output.
        truncated = False
        if len(output) > MAX_OUTPUT_BYTES:
            output = output[:MAX_OUTPUT_BYTES] + "\n[truncated]"
            truncated = True

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
    extra_env: dict[str, str] | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with the execute_bash function.

    Args:
        work_dir: Persistent working directory for commands. If None,
            a temporary directory is created (and persists for the
            process lifetime).
        timeout: Default timeout in seconds per command.
        extra_env: Extra environment variables to inject into the
            subprocess (e.g., access tokens).

    Returns:
        A FunctionGroup ready to append to the agent's tool set.
    """
    if work_dir is None:
        work_dir = Path(tempfile.mkdtemp(prefix="ark-sandbox-"))
    work_dir.mkdir(parents=True, exist_ok=True)

    handlers = _make_handlers(work_dir=work_dir, timeout=timeout, extra_env=extra_env)
    loaded = load_declarations("sandbox", declarations_dir=_DECLARATIONS_DIR)
    return assemble_function_group(loaded, handlers)

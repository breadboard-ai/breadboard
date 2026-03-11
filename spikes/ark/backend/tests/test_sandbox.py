"""Tests for the DangerousSandbox function group."""

import asyncio
import platform

import pytest

from ark_backend.sandbox import (
    DEFAULT_TIMEOUT_SEC,
    MAX_OUTPUT_BYTES,
    get_sandbox_function_group,
)
from opal_backend.function_definition import FunctionGroup


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop_status_cb(status=None, opts=None):
    """No-op status callback for handler tests."""
    pass


def _get_handler(group: FunctionGroup, name: str):
    """Extract a handler function from a FunctionGroup by name."""
    for fn_name, fn_def in group.definitions:
        if fn_name == name:
            return fn_def.handler
    raise KeyError(f"Handler '{name}' not found in group")


# ---------------------------------------------------------------------------
# FunctionGroup construction
# ---------------------------------------------------------------------------


def test_group_has_one_declaration():
    group = get_sandbox_function_group()
    assert isinstance(group, FunctionGroup)
    assert len(group.declarations) == 1
    assert group.declarations[0]["name"] == "execute_bash"


def test_group_has_instruction():
    group = get_sandbox_function_group()
    assert group.instruction
    assert "$HOME" in group.instruction


def test_group_has_definition():
    group = get_sandbox_function_group()
    assert len(group.definitions) == 1
    name, defn = group.definitions[0]
    assert name == "execute_bash"
    assert defn.icon == "terminal"
    assert defn.title == "Run Bash"


# ---------------------------------------------------------------------------
# execute_bash handler
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_echo():
    group = get_sandbox_function_group()
    handler = _get_handler(group, "execute_bash")
    result = await handler({"command": "echo hello"}, _noop_status_cb)
    assert result["exit_code"] == 0
    assert result["stdout"].strip() == "hello"
    assert "error" not in result


@pytest.mark.asyncio
async def test_empty_command():
    group = get_sandbox_function_group()
    handler = _get_handler(group, "execute_bash")
    result = await handler({"command": ""}, _noop_status_cb)
    assert "error" in result


@pytest.mark.asyncio
async def test_nonzero_exit():
    group = get_sandbox_function_group()
    handler = _get_handler(group, "execute_bash")
    result = await handler({"command": "exit 42"}, _noop_status_cb)
    assert result["exit_code"] == 42


@pytest.mark.asyncio
async def test_stderr_captured():
    group = get_sandbox_function_group()
    handler = _get_handler(group, "execute_bash")
    result = await handler(
        {"command": "echo err >&2"},
        _noop_status_cb,
    )
    assert "err" in result["stdout"]
    assert result["exit_code"] == 0


@pytest.mark.asyncio
async def test_timeout():
    group = get_sandbox_function_group(timeout=1)
    handler = _get_handler(group, "execute_bash")
    result = await handler(
        {"command": "sleep 60", "timeout": 1},
        _noop_status_cb,
    )
    assert "error" in result
    assert "timed out" in result["error"]


@pytest.mark.asyncio
async def test_output_truncation():
    group = get_sandbox_function_group()
    handler = _get_handler(group, "execute_bash")
    # Generate output larger than MAX_OUTPUT_BYTES.
    # Using python to guarantee deterministic output size.
    cmd = f'python3 -c "print(\'x\' * {MAX_OUTPUT_BYTES + 1000})"'
    result = await handler({"command": cmd}, _noop_status_cb)
    assert result.get("truncated") is True
    assert result["stdout"].endswith("[truncated]")
    assert len(result["stdout"]) <= MAX_OUTPUT_BYTES + 100  # slack for marker


@pytest.mark.asyncio
async def test_work_dir_is_home(tmp_path):
    group = get_sandbox_function_group(work_dir=tmp_path)
    handler = _get_handler(group, "execute_bash")
    result = await handler({"command": "echo $HOME"}, _noop_status_cb)
    assert result["stdout"].strip() == str(tmp_path)


@pytest.mark.asyncio
async def test_files_persist_across_calls(tmp_path):
    group = get_sandbox_function_group(work_dir=tmp_path)
    handler = _get_handler(group, "execute_bash")

    # Write a file.
    r1 = await handler(
        {"command": "echo 'persisted' > $HOME/test.txt"},
        _noop_status_cb,
    )
    assert r1["exit_code"] == 0

    # Read it back in a separate call.
    r2 = await handler(
        {"command": "cat $HOME/test.txt"},
        _noop_status_cb,
    )
    assert r2["exit_code"] == 0
    assert r2["stdout"].strip() == "persisted"

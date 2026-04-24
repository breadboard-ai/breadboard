# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the LiveRunner and LiveStream."""

from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from bees.protocols.functions import (
    FunctionGroup,
    FunctionDefinition,
)
from bees.protocols.session import SessionConfiguration
from bees.runners.live import (
    BUNDLE_FILENAME,
    RESULT_FILENAME,
    TOOL_DISPATCH_DIR,
    LiveRunner,
    LiveStream,
    ToolDispatchWatcher,
    _LiveHooks,
    _assemble_system_instruction,
    _extract_declarations,
    _matches_filter,
    _build_bundle,
    _write_bundle,
    SessionBundle,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


def _make_test_factory(
    name: str,
    declarations: list[dict],
    instruction: str | None = None,
):
    """Create a test function group factory."""
    async def _handler(args, status):
        return {}

    defs = [
        (decl["name"], FunctionDefinition(
            name=decl["name"],
            description=decl.get("description", ""),
            handler=_handler,
        ))
        for decl in declarations
    ]

    def factory(hooks):
        return FunctionGroup(
            name=name,
            definitions=defs,
            declarations=declarations,
            instruction=instruction,
        )

    return factory


def _make_config(
    temp_dir: Path,
    *,
    segments: list | None = None,
    factories: list | None = None,
    function_filter: list[str] | None = None,
    model: str | None = None,
) -> SessionConfiguration:
    """Create a minimal SessionConfiguration for testing."""
    fs = MagicMock()
    return SessionConfiguration(
        segments=segments or [],
        function_groups=factories or [],
        function_filter=function_filter,
        model=model,
        file_system=fs,
        ticket_id="test-task-id",
        ticket_dir=temp_dir,
        label="test",
    )


# ---------------------------------------------------------------------------
# _NullHooks
# ---------------------------------------------------------------------------


def test_live_hooks_satisfies_protocol(temp_dir):
    """_LiveHooks can be used where SessionHooks is expected."""
    hooks = _LiveHooks(temp_dir)
    assert hooks.controller is not None
    assert hooks.file_system is None
    assert hooks.task_tree_manager is None


# ---------------------------------------------------------------------------
# _matches_filter
# ---------------------------------------------------------------------------


def test_matches_filter_exact():
    assert _matches_filter("tasks_create_task", ["tasks_create_task"])


def test_matches_filter_glob():
    assert _matches_filter("tasks_create_task", ["tasks.*"])
    assert _matches_filter("tasks_list", ["tasks.*"])


def test_matches_filter_miss():
    assert not _matches_filter("files_read", ["tasks.*"])
    assert not _matches_filter("other_fn", ["tasks_create_task"])


def test_matches_filter_multiple_patterns():
    assert _matches_filter("files_read", ["tasks.*", "files.*"])


# ---------------------------------------------------------------------------
# _extract_declarations
# ---------------------------------------------------------------------------


def test_extract_declarations_no_filter():
    factory = _make_test_factory("tools", [
        {"name": "tool_a", "description": "A"},
        {"name": "tool_b", "description": "B"},
    ], instruction="Use these tools wisely.")

    decls, instruction, handlers = _extract_declarations([factory], None)

    assert len(decls) == 2
    assert decls[0]["name"] == "tool_a"
    assert "Use these tools wisely." in instruction


def test_extract_declarations_with_filter():
    factory = _make_test_factory("tools", [
        {"name": "tool_a", "description": "A"},
        {"name": "tool_b", "description": "B"},
    ])

    decls, _, handlers = _extract_declarations([factory], ["tool_a"])

    assert len(decls) == 1
    assert decls[0]["name"] == "tool_a"


def test_extract_declarations_multiple_groups():
    f1 = _make_test_factory("group1", [
        {"name": "g1_fn", "description": "G1"},
    ], instruction="Group 1 instructions.")
    f2 = _make_test_factory("group2", [
        {"name": "g2_fn", "description": "G2"},
    ], instruction="Group 2 instructions.")

    decls, instruction, handlers = _extract_declarations([f1, f2], None)

    assert len(decls) == 2
    assert "Group 1 instructions." in instruction
    assert "Group 2 instructions." in instruction


def test_extract_declarations_returns_handlers():
    """Handler map contains handlers for all included declarations."""
    factory = _make_test_factory("tools", [
        {"name": "tool_a", "description": "A"},
        {"name": "tool_b", "description": "B"},
    ])

    decls, _, handlers = _extract_declarations([factory], None)

    assert len(handlers) == 2
    assert "tool_a" in handlers
    assert "tool_b" in handlers
    assert callable(handlers["tool_a"])


def test_extract_declarations_handlers_respect_filter():
    """Handler map only includes declarations that pass the filter."""
    factory = _make_test_factory("tools", [
        {"name": "tool_a", "description": "A"},
        {"name": "tool_b", "description": "B"},
    ])

    _, _, handlers = _extract_declarations([factory], ["tool_a"])

    assert len(handlers) == 1
    assert "tool_a" in handlers
    assert "tool_b" not in handlers


# ---------------------------------------------------------------------------
# _assemble_system_instruction
# ---------------------------------------------------------------------------


def test_assemble_system_instruction():
    segments = [
        {"parts": [{"text": "You are Opie."}]},
        {"parts": [{"text": "Be helpful."}]},
    ]
    result = _assemble_system_instruction(segments, "Tool usage notes.")

    assert "You are Opie." in result
    assert "Be helpful." in result
    assert "Tool usage notes." in result


def test_assemble_system_instruction_empty_tool_instruction():
    segments = [{"parts": [{"text": "Hello."}]}]
    result = _assemble_system_instruction(segments, "")

    assert result == "Hello."


# ---------------------------------------------------------------------------
# _build_bundle
# ---------------------------------------------------------------------------


def test_build_bundle(temp_dir):
    config = _make_config(temp_dir, model="models/gemini-test")

    bundle = _build_bundle(
        config=config,
        token="ephemeral-token",
        declarations=[{"name": "fn1", "description": "Test"}],
        system_instruction="You are a test agent.",
    )

    assert bundle.token == "ephemeral-token"
    assert bundle.task_id == "test-task-id"
    assert bundle.setup["model"] == "models/gemini-test"
    assert bundle.setup["systemInstruction"]["parts"][0]["text"] == "You are a test agent."
    assert len(bundle.setup["tools"][0]["functionDeclarations"]) == 1


def test_build_bundle_no_declarations(temp_dir):
    config = _make_config(temp_dir)
    bundle = _build_bundle(
        config=config,
        token="token",
        declarations=[],
        system_instruction="Hello.",
    )
    assert "tools" not in bundle.setup


# ---------------------------------------------------------------------------
# _write_bundle
# ---------------------------------------------------------------------------


def test_write_bundle(temp_dir):
    bundle = SessionBundle(
        token="test-token",
        endpoint="wss://example.com",
        setup={"model": "test-model"},
        task_id="task-123",
    )

    path = _write_bundle(bundle, temp_dir)

    assert path == temp_dir / BUNDLE_FILENAME
    assert path.exists()

    data = json.loads(path.read_text())
    assert data["token"] == "test-token"
    assert data["task_id"] == "task-123"


# ---------------------------------------------------------------------------
# LiveStream
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_live_stream_completes_on_result(temp_dir):
    """LiveStream yields completion when live_result.json appears."""
    stream = LiveStream(temp_dir, poll_interval=0.05)

    # Write the result file after a short delay.
    async def write_result():
        await asyncio.sleep(0.1)
        result_path = temp_dir / RESULT_FILENAME
        result_path.write_text(json.dumps({
            "status": "completed",
            "outcomes": {"parts": [{"text": "Done."}]},
        }))

    asyncio.create_task(write_result())

    events = []
    async for event in stream:
        events.append(event)

    assert len(events) == 1
    assert "complete" in events[0]
    assert events[0]["complete"]["result"]["success"] is True


@pytest.mark.asyncio
async def test_live_stream_handles_failure(temp_dir):
    """LiveStream yields error event when result reports failure."""
    stream = LiveStream(temp_dir, poll_interval=0.05)

    result_path = temp_dir / RESULT_FILENAME
    result_path.write_text(json.dumps({
        "status": "failed",
        "error": "WebSocket disconnected",
    }))

    events = []
    async for event in stream:
        events.append(event)

    assert len(events) == 1
    assert "error" in events[0]
    assert "WebSocket disconnected" in events[0]["error"]["message"]


@pytest.mark.asyncio
async def test_live_stream_send_context(temp_dir):
    """send_context writes a context update file."""
    stream = LiveStream(temp_dir)

    await stream.send_context([{"text": "Update from subagent."}])

    updates_dir = temp_dir / "context_updates"
    assert updates_dir.exists()

    files = list(updates_dir.iterdir())
    assert len(files) == 1

    data = json.loads(files[0].read_text())
    assert data["parts"][0]["text"] == "Update from subagent."


@pytest.mark.asyncio
async def test_live_stream_resume_state_is_none(temp_dir):
    """resume_state returns None for live sessions."""
    stream = LiveStream(temp_dir)
    assert stream.resume_state() is None


# ---------------------------------------------------------------------------
# LiveRunner
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_live_runner_requires_ticket_dir():
    """LiveRunner.run() raises if ticket_dir is missing."""
    runner = LiveRunner(api_key="test-key")
    config = SessionConfiguration(
        segments=[],
        function_groups=[],
        function_filter=None,
        model=None,
        file_system=MagicMock(),
        # ticket_dir intentionally omitted (defaults to None)
    )

    with pytest.raises(ValueError, match="ticket_dir"):
        await runner.run(config)


@pytest.mark.asyncio
async def test_live_runner_writes_bundle(temp_dir):
    """LiveRunner.run() provisions and writes the session bundle."""
    runner = LiveRunner(api_key="test-key")

    factory = _make_test_factory("test", [
        {"name": "test_fn", "description": "A test function"},
    ], instruction="Test tool instructions.")

    config = _make_config(
        temp_dir,
        segments=[{"parts": [{"text": "You are a test agent."}]}],
        factories=[factory],
        model="models/test-model",
    )

    # Mock the ephemeral token request.
    with patch.object(runner, "_get_ephemeral_token", return_value="mock-token"):
        stream = await runner.run(config)

    # Verify the bundle was written.
    bundle_path = temp_dir / BUNDLE_FILENAME
    assert bundle_path.exists()

    data = json.loads(bundle_path.read_text())
    assert data["token"] == "mock-token"
    assert data["task_id"] == "test-task-id"
    assert data["setup"]["model"] == "models/test-model"
    assert "test_fn" in json.dumps(data["setup"]["tools"])
    assert "You are a test agent." in data["setup"]["systemInstruction"]["parts"][0]["text"]

    # Verify the stream is a LiveStream.
    assert isinstance(stream, LiveStream)


@pytest.mark.asyncio
async def test_live_runner_resume_raises():
    """LiveRunner.resume() raises NotImplementedError."""
    runner = LiveRunner(api_key="test-key")
    config = _make_config(Path("/tmp/fake"))

    with pytest.raises(NotImplementedError, match="cannot be resumed"):
        await runner.resume(config, state=b"")


# ---------------------------------------------------------------------------
# ToolDispatchWatcher
# ---------------------------------------------------------------------------


def _make_handler_map(handlers: dict[str, any]):
    """Create a handler map from simple sync functions."""
    result = {}
    for name, fn in handlers.items():
        async def _handler(args, status, _fn=fn):
            return _fn(args)
        result[name] = _handler
    return result


@pytest.mark.asyncio
async def test_tool_dispatch_watcher_processes_call(temp_dir):
    """Watcher reads a call file, executes the handler, writes the result."""
    dispatch_dir = temp_dir / TOOL_DISPATCH_DIR
    dispatch_dir.mkdir()

    handler_map = _make_handler_map({
        "list_files": lambda args: {"files": ["a.txt", "b.txt"]},
    })

    watcher = ToolDispatchWatcher(dispatch_dir, handler_map, poll_interval=0.05)

    # Write a call file.
    call_path = dispatch_dir / "call-001.json"
    call_path.write_text(json.dumps({
        "functionCall": {
            "id": "call-001",
            "name": "list_files",
            "args": {"path": "/"},
        },
    }))

    # Run one scan cycle.
    await watcher._scan_once()

    # Verify the result file was written.
    result_path = dispatch_dir / "call-001.result.json"
    assert result_path.exists()

    result = json.loads(result_path.read_text())
    assert result["functionResponse"]["id"] == "call-001"
    assert result["functionResponse"]["name"] == "list_files"
    assert result["functionResponse"]["response"]["files"] == ["a.txt", "b.txt"]


@pytest.mark.asyncio
async def test_tool_dispatch_watcher_handles_error(temp_dir):
    """Watcher writes an error result when the handler raises."""
    dispatch_dir = temp_dir / TOOL_DISPATCH_DIR
    dispatch_dir.mkdir()

    def _failing_handler(args):
        raise RuntimeError("disk full")

    handler_map = _make_handler_map({"fail_fn": _failing_handler})
    watcher = ToolDispatchWatcher(dispatch_dir, handler_map, poll_interval=0.05)

    call_path = dispatch_dir / "call-err.json"
    call_path.write_text(json.dumps({
        "functionCall": {
            "id": "call-err",
            "name": "fail_fn",
            "args": {},
        },
    }))

    await watcher._scan_once()

    result_path = dispatch_dir / "call-err.result.json"
    assert result_path.exists()

    result = json.loads(result_path.read_text())
    assert "disk full" in result["functionResponse"]["response"]["error"]


@pytest.mark.asyncio
async def test_tool_dispatch_watcher_unknown_handler(temp_dir):
    """Watcher writes error for unknown function names."""
    dispatch_dir = temp_dir / TOOL_DISPATCH_DIR
    dispatch_dir.mkdir()

    watcher = ToolDispatchWatcher(dispatch_dir, {}, poll_interval=0.05)

    call_path = dispatch_dir / "call-unknown.json"
    call_path.write_text(json.dumps({
        "functionCall": {
            "id": "call-unknown",
            "name": "nonexistent_fn",
            "args": {},
        },
    }))

    await watcher._scan_once()

    result_path = dispatch_dir / "call-unknown.result.json"
    assert result_path.exists()

    result = json.loads(result_path.read_text())
    assert "Unknown function" in result["functionResponse"]["response"]["error"]


@pytest.mark.asyncio
async def test_tool_dispatch_watcher_skips_processed(temp_dir):
    """Watcher skips calls that already have a result file."""
    dispatch_dir = temp_dir / TOOL_DISPATCH_DIR
    dispatch_dir.mkdir()

    call_count = 0

    def _counting_handler(args):
        nonlocal call_count
        call_count += 1
        return {"ok": True}

    handler_map = _make_handler_map({"count_fn": _counting_handler})
    watcher = ToolDispatchWatcher(dispatch_dir, handler_map, poll_interval=0.05)

    # Write call and pre-existing result.
    call_path = dispatch_dir / "call-skip.json"
    call_path.write_text(json.dumps({
        "functionCall": {
            "id": "call-skip",
            "name": "count_fn",
            "args": {},
        },
    }))
    result_path = dispatch_dir / "call-skip.result.json"
    result_path.write_text(json.dumps({
        "functionResponse": {
            "id": "call-skip",
            "name": "count_fn",
            "response": {"ok": True},
        },
    }))

    await watcher._scan_once()

    assert call_count == 0, "Handler should not be called for pre-processed calls"


@pytest.mark.asyncio
async def test_tool_dispatch_watcher_stops_on_cancel(temp_dir):
    """Watcher run() terminates cleanly on cancellation."""
    dispatch_dir = temp_dir / TOOL_DISPATCH_DIR

    watcher = ToolDispatchWatcher(dispatch_dir, {}, poll_interval=0.02)
    task = asyncio.create_task(watcher.run())

    # Let it run a few cycles.
    await asyncio.sleep(0.1)
    assert not task.done()

    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task


@pytest.mark.asyncio
async def test_live_stream_cancels_watcher(temp_dir):
    """LiveStream cancels the watcher task when the stream exhausts."""
    # Create a dummy watcher task.
    async def _dummy_watcher():
        try:
            while True:
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            raise

    watcher_task = asyncio.create_task(_dummy_watcher())

    stream = LiveStream(temp_dir, poll_interval=0.05, watcher_task=watcher_task)

    # Write the result file immediately.
    result_path = temp_dir / RESULT_FILENAME
    result_path.write_text(json.dumps({"status": "completed"}))

    # Drain the stream.
    events = []
    async for event in stream:
        events.append(event)

    assert len(events) == 1
    assert "complete" in events[0]

    # Give a tick for the cancellation to propagate.
    await asyncio.sleep(0.05)
    assert watcher_task.cancelled() or watcher_task.done()

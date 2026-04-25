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
    LIVE_EVENTS_DIR,
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
    voice: str | None = None,
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
        voice=voice,
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


def test_extract_declarations_filters_instructions():
    """Instructions from groups with all declarations filtered out are excluded."""
    system_factory = _make_test_factory(
        "system",
        [{"name": "system_objective_fulfilled", "description": "done"}],
        instruction="System instruction",
    )
    files_factory = _make_test_factory(
        "files",
        [{"name": "files_list", "description": "list"}],
        instruction="Files instruction",
    )

    # Only system.* passes the filter — files instruction should be excluded.
    decls, instruction, _ = _extract_declarations(
        [system_factory, files_factory], ["system.*"],
    )

    assert len(decls) == 1
    assert decls[0]["name"] == "system_objective_fulfilled"
    assert "System instruction" in instruction
    assert "Files instruction" not in instruction


def test_extract_declarations_instruction_only_matches_filter():
    """Instruction-only groups are included when their name matches the filter."""
    live_group = FunctionGroup(
        name="live",
        declarations=[],
        definitions=[],
        instruction="Live instruction",
    )
    skills_group = FunctionGroup(
        name="skills",
        declarations=[],
        definitions=[],
        instruction="Skills instruction",
    )

    # Filter includes live.* but not skills.* — only live instruction appears.
    _, instruction, _ = _extract_declarations(
        [live_group, skills_group], ["live.*", "files.*"],
    )

    assert "Live instruction" in instruction
    assert "Skills instruction" not in instruction


def test_extract_declarations_instruction_only_no_filter():
    """Without a filter, all instruction-only groups are included."""
    live_group = FunctionGroup(
        name="live",
        declarations=[],
        definitions=[],
        instruction="Live instruction",
    )
    skills_group = FunctionGroup(
        name="skills",
        declarations=[],
        definitions=[],
        instruction="Skills instruction",
    )

    _, instruction, _ = _extract_declarations(
        [live_group, skills_group], None,
    )

    assert "Live instruction" in instruction
    assert "Skills instruction" in instruction


def test_extract_declarations_skills_leak_regression():
    """Skills instruction must not leak into live sessions (regression).

    When the filter is [live.*, files.*], the skills group (instruction-only,
    name='skills') should NOT have its instruction included.
    """
    system_factory = _make_test_factory(
        "system",
        [{"name": "system_objective_fulfilled", "description": "done"}],
        instruction="System instruction",
    )
    live_group = FunctionGroup(
        name="live",
        declarations=[],
        definitions=[],
        instruction="Live instruction",
    )
    skills_group = FunctionGroup(
        name="skills",
        declarations=[],
        definitions=[],
        instruction="Skills instruction",
    )

    _, instruction, _ = _extract_declarations(
        [system_factory, live_group, skills_group],
        ["live.*", "files.*"],
    )

    assert "Live instruction" in instruction
    # system.* is not in the filter, so system instruction should be excluded.
    assert "System instruction" not in instruction
    # skills.* is not in the filter, so skills instruction should be excluded.
    assert "Skills instruction" not in instruction


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


def test_assemble_system_instruction_text_segments():
    """Segments from resolve_segments use {"type": "text", "text": "..."} format."""
    segments = [
        {"type": "text", "text": "Act as a translator."},
        {"type": "text", "text": "Be concise."},
    ]
    result = _assemble_system_instruction(segments, "Tool notes.")

    assert "Act as a translator." in result
    assert "Be concise." in result
    assert "Tool notes." in result


def test_assemble_system_instruction_mixed_formats():
    """Both parts-based and direct text segments work together."""
    segments = [
        {"type": "text", "text": "Objective from resolve_segments."},
        {"parts": [{"text": "Instruction from function group."}]},
    ]
    result = _assemble_system_instruction(segments, "")

    assert "Objective from resolve_segments." in result
    assert "Instruction from function group." in result


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


def test_build_bundle_includes_enhanced_capabilities(temp_dir):
    """Setup includes VAD tuning, proactive audio, and affective dialog."""
    config = _make_config(temp_dir)
    bundle = _build_bundle(
        config=config,
        token="token",
        declarations=[],
        system_instruction="Hello.",
    )
    setup = bundle.setup

    # VAD tuning.
    vad = setup["realtimeInputConfig"]["automaticActivityDetection"]
    assert vad["startOfSpeechSensitivity"] == "START_SENSITIVITY_LOW"
    assert vad["endOfSpeechSensitivity"] == "END_SENSITIVITY_LOW"
    assert vad["silenceDurationMs"] == 500

    # Proactive audio (setup-level field).
    assert setup["proactivity"]["proactiveAudio"] is True


def test_build_bundle_voice_from_config(temp_dir):
    """Voice name comes from SessionConfiguration.voice."""
    config = _make_config(temp_dir, voice="Puck")
    bundle = _build_bundle(
        config=config,
        token="token",
        declarations=[],
        system_instruction="Hello.",
    )
    voice_name = (
        bundle.setup["generationConfig"]["speechConfig"]
        ["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"]
    )
    assert voice_name == "Puck"


def test_build_bundle_voice_default(temp_dir):
    """When no voice is set, defaults to Kore."""
    config = _make_config(temp_dir)
    bundle = _build_bundle(
        config=config,
        token="token",
        declarations=[],
        system_instruction="Hello.",
    )
    voice_name = (
        bundle.setup["generationConfig"]["speechConfig"]
        ["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"]
    )
    assert voice_name == "Kore"


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
# LiveStream — event channel
# ---------------------------------------------------------------------------


def _write_event(events_dir: Path, seq: int, data: dict) -> None:
    """Write an event file to the live_events directory."""
    filename = f"{seq:06d}.json"
    (events_dir / filename).write_text(json.dumps(data))


@pytest.mark.asyncio
async def test_live_stream_session_start(temp_dir):
    """sessionStart event emits initial sendRequest with config."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    stream = LiveStream(temp_dir, poll_interval=0.05)

    _write_event(events_dir, 0, {
        "type": "sessionStart",
        "config": {
            "model": "test-model",
            "systemInstruction": {"parts": [{"text": "Be helpful."}]},
        },
    })
    _write_event(events_dir, 1, {
        "type": "sessionEnd",
        "status": "completed",
    })

    events = []
    async for event in stream:
        events.append(event)

    # sessionStart yields an initial sendRequest + sessionEnd yields complete.
    assert len(events) == 2
    assert "sendRequest" in events[0]
    body = events[0]["sendRequest"]["body"]
    assert body["systemInstruction"]["parts"][0]["text"] == "Be helpful."
    assert "complete" in events[1]


@pytest.mark.asyncio
async def test_live_stream_tool_call_without_turn_complete(temp_dir):
    """toolCall without preceding turnComplete synthesizes a sendRequest."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {
        "type": "sessionStart",
        "config": {
            "systemInstruction": {"parts": [{"text": "Test."}]},
        },
    })
    # Model goes straight to tool call — no turnComplete.
    _write_event(events_dir, 1, {
        "type": "toolCall",
        "functionCalls": [
            {"name": "list_files", "args": {}, "id": "c1"},
        ],
    })
    _write_event(events_dir, 2, {
        "type": "toolResponse",
        "functionResponses": [
            {"name": "list_files", "id": "c1", "response": {"files": []}},
        ],
    })
    # Second tool call after tool response.
    _write_event(events_dir, 3, {
        "type": "toolCall",
        "functionCalls": [
            {"name": "done", "args": {"result": "ok"}, "id": "c2"},
        ],
    })
    _write_event(events_dir, 4, {
        "type": "toolResponse",
        "functionResponses": [
            {"name": "done", "id": "c2", "response": {}},
        ],
    })
    _write_event(events_dir, 5, {
        "type": "sessionEnd",
        "status": "completed",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    # Expected: sendRequest(sessionStart) + functionCall(list_files)
    #         + sendRequest(after toolResponse resets flag) + functionCall(done)
    #         + sendRequest(final flush from sessionEnd) + complete
    types = [list(e.keys())[0] for e in events]
    assert types == [
        "sendRequest",    # from sessionStart
        "functionCall",   # list_files (no extra sendRequest — turn already emitted)
        "sendRequest",    # synthesized because toolResponse reset the flag
        "functionCall",   # done
        "sendRequest",    # final flush — captures done's toolResponse
        "complete",
    ]
    # Final sendRequest should have both tool responses in context.
    final_body = events[4]["sendRequest"]["body"]
    fn_response_count = sum(
        1 for entry in final_body["contents"]
        for p in entry.get("parts", [])
        if "functionResponse" in p
    )
    assert fn_response_count == 2  # list_files + done


@pytest.mark.asyncio
async def test_live_stream_turn_complete(temp_dir):
    """turnComplete yields a synthetic sendRequest event."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    stream = LiveStream(temp_dir, poll_interval=0.05)

    _write_event(events_dir, 0, {
        "type": "turnComplete",
        "parts": [{"text": "Hello, I can help!"}],
    })
    _write_event(events_dir, 1, {
        "type": "sessionEnd",
        "status": "completed",
    })

    events = []
    async for event in stream:
        events.append(event)

    assert len(events) == 2  # sendRequest + complete
    assert "sendRequest" in events[0]
    body = events[0]["sendRequest"]["body"]
    # Context should contain the model turn.
    assert len(body["contents"]) == 1
    assert body["contents"][0]["role"] == "model"
    assert body["contents"][0]["parts"][0]["text"] == "Hello, I can help!"


@pytest.mark.asyncio
async def test_live_stream_tool_call(temp_dir):
    """toolCall yields functionCall events."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {
        "type": "toolCall",
        "functionCalls": [
            {"name": "list_files", "args": {"path": "/"}, "id": "c1"},
        ],
    })
    _write_event(events_dir, 1, {
        "type": "sessionEnd",
        "status": "completed",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    # sendRequest (synthesized for missing turn) + functionCall + complete
    assert len(events) == 3
    assert "sendRequest" in events[0]
    assert "functionCall" in events[1]
    assert events[1]["functionCall"]["name"] == "list_files"


@pytest.mark.asyncio
async def test_live_stream_tool_response_adds_context(temp_dir):
    """toolResponse adds to context, visible in next turnComplete."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    # Turn 1: model speaks, tool is called, tool responds.
    _write_event(events_dir, 0, {
        "type": "turnComplete",
        "parts": [{"text": "Let me check."}],
    })
    _write_event(events_dir, 1, {
        "type": "toolResponse",
        "functionResponses": [
            {"name": "list_files", "id": "c1", "response": {"files": ["a.txt"]}},
        ],
    })
    # Turn 2: model responds after seeing tool output.
    _write_event(events_dir, 2, {
        "type": "turnComplete",
        "parts": [{"text": "Found a.txt!"}],
    })
    _write_event(events_dir, 3, {
        "type": "sessionEnd",
        "status": "completed",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    # sendRequest(turn1) + sendRequest(turn2) + complete
    assert len(events) == 3
    # Second sendRequest should have tool response in context.
    body2 = events[1]["sendRequest"]["body"]
    assert len(body2["contents"]) == 3  # model, user(toolResponse), model
    assert body2["contents"][1]["role"] == "user"
    assert "functionResponse" in body2["contents"][1]["parts"][0]


@pytest.mark.asyncio
async def test_live_stream_usage_metadata(temp_dir):
    """usageMetadata yields a usageMetadata event."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {
        "type": "usageMetadata",
        "metadata": {
            "promptTokenCount": 100,
            "candidatesTokenCount": 50,
            "totalTokenCount": 150,
        },
    })
    _write_event(events_dir, 1, {
        "type": "sessionEnd",
        "status": "completed",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    assert len(events) == 3  # usageMetadata + sendRequest (flush) + complete
    assert "usageMetadata" in events[0]
    assert events[0]["usageMetadata"]["metadata"]["totalTokenCount"] == 150


@pytest.mark.asyncio
async def test_live_stream_context_update(temp_dir):
    """contextUpdate adds to context, visible in next turnComplete."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {
        "type": "contextUpdate",
        "parts": [{"text": "Subagent completed: report ready."}],
    })
    _write_event(events_dir, 1, {
        "type": "turnComplete",
        "parts": [{"text": "I see the report."}],
    })
    _write_event(events_dir, 2, {
        "type": "sessionEnd",
        "status": "completed",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    # sendRequest + complete
    assert len(events) == 2
    body = events[0]["sendRequest"]["body"]
    # Context: user(contextUpdate) + model(turnComplete)
    assert len(body["contents"]) == 2
    assert body["contents"][0]["role"] == "user"
    assert body["contents"][0]["parts"][0]["text"] == "Subagent completed: report ready."


@pytest.mark.asyncio
async def test_live_stream_input_transcript(temp_dir):
    """inputTranscript adds user speech to context."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {
        "type": "inputTranscript",
        "text": "How many files do I have?",
    })
    _write_event(events_dir, 1, {
        "type": "turnComplete",
        "parts": [{"text": "Let me check."}],
    })
    _write_event(events_dir, 2, {
        "type": "sessionEnd",
        "status": "completed",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    # sendRequest (from turnComplete) + complete
    assert len(events) == 2
    body = events[0]["sendRequest"]["body"]
    # Context: user(transcript) + model(turnComplete)
    assert len(body["contents"]) == 2
    assert body["contents"][0]["role"] == "user"
    assert body["contents"][0]["parts"][0]["text"] == "How many files do I have?"
    assert body["contents"][1]["role"] == "model"


@pytest.mark.asyncio
async def test_live_stream_output_transcript(temp_dir):
    """outputTranscript adds model speech to context."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {
        "type": "outputTranscript",
        "text": "You have zero files.",
    })
    _write_event(events_dir, 1, {
        "type": "sessionEnd",
        "status": "completed",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    # sendRequest (flush) + complete
    assert len(events) == 2
    body = events[0]["sendRequest"]["body"]
    assert len(body["contents"]) == 1
    assert body["contents"][0]["role"] == "model"
    assert body["contents"][0]["parts"][0]["text"] == "You have zero files."


@pytest.mark.asyncio
async def test_live_stream_coalesces_output_transcript(temp_dir):
    """Consecutive outputTranscript fragments merge into one context entry."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    # Simulate word-by-word transcription from the Live API.
    _write_event(events_dir, 0, {"type": "outputTranscript", "text": "You "})
    _write_event(events_dir, 1, {"type": "outputTranscript", "text": "have "})
    _write_event(events_dir, 2, {"type": "outputTranscript", "text": "zero "})
    _write_event(events_dir, 3, {"type": "outputTranscript", "text": "files."})
    _write_event(events_dir, 4, {"type": "sessionEnd", "status": "completed"})

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    body = events[0]["sendRequest"]["body"]
    # All four fragments coalesce into a single model entry.
    assert len(body["contents"]) == 1
    assert body["contents"][0]["role"] == "model"
    assert body["contents"][0]["parts"][0]["text"] == "You have zero files."


@pytest.mark.asyncio
async def test_live_stream_coalesces_input_transcript(temp_dir):
    """Consecutive inputTranscript fragments merge into one context entry."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {"type": "inputTranscript", "text": "List "})
    _write_event(events_dir, 1, {"type": "inputTranscript", "text": "my files."})
    _write_event(events_dir, 2, {"type": "outputTranscript", "text": "Sure!"})
    _write_event(events_dir, 3, {"type": "sessionEnd", "status": "completed"})

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    body = events[0]["sendRequest"]["body"]
    # Input fragments coalesce, then a new entry for the model role.
    assert len(body["contents"]) == 2
    assert body["contents"][0]["role"] == "user"
    assert body["contents"][0]["parts"][0]["text"] == "List my files."
    assert body["contents"][1]["role"] == "model"
    assert body["contents"][1]["parts"][0]["text"] == "Sure!"


@pytest.mark.asyncio
async def test_live_stream_session_end_failure(temp_dir):
    """sessionEnd with failed status yields error event."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    _write_event(events_dir, 0, {
        "type": "sessionEnd",
        "status": "failed",
        "error": "Connection lost",
    })

    stream = LiveStream(temp_dir, poll_interval=0.05)
    events = []
    async for event in stream:
        events.append(event)

    # sendRequest (final flush) + error
    assert len(events) == 2
    assert "sendRequest" in events[0]
    assert "error" in events[1]
    assert "Connection lost" in events[1]["error"]["message"]


@pytest.mark.asyncio
async def test_live_stream_config_from_setup(temp_dir):
    """LiveStream can receive initial config via constructor."""
    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    setup = {
        "model": "models/gemini-test",
        "systemInstruction": {"parts": [{"text": "You are helpful."}]},
        "generationConfig": {"temperature": 0.7},
    }

    stream = LiveStream(temp_dir, setup=setup, poll_interval=0.05)

    _write_event(events_dir, 0, {
        "type": "turnComplete",
        "parts": [{"text": "Hi there."}],
    })
    _write_event(events_dir, 1, {
        "type": "sessionEnd",
        "status": "completed",
    })

    events = []
    async for event in stream:
        events.append(event)

    # sendRequest should include config from setup.
    body = events[0]["sendRequest"]["body"]
    assert body["systemInstruction"]["parts"][0]["text"] == "You are helpful."
    assert body["generationConfig"]["temperature"] == 0.7


# ---------------------------------------------------------------------------
# LiveStream — fallback (crash recovery)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_live_stream_fallback_completes_on_result(temp_dir):
    """LiveStream yields completion via live_result.json fallback."""
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

    assert len(events) == 2  # sendRequest (flush) + complete
    assert "sendRequest" in events[0]
    assert "complete" in events[1]
    assert events[1]["complete"]["result"]["success"] is True


@pytest.mark.asyncio
async def test_live_stream_fallback_handles_failure(temp_dir):
    """LiveStream yields error event via live_result.json fallback."""
    stream = LiveStream(temp_dir, poll_interval=0.05)

    result_path = temp_dir / RESULT_FILENAME
    result_path.write_text(json.dumps({
        "status": "failed",
        "error": "WebSocket disconnected",
    }))

    events = []
    async for event in stream:
        events.append(event)

    assert len(events) == 2  # sendRequest (flush) + error
    assert "sendRequest" in events[0]
    assert "error" in events[1]
    assert "WebSocket disconnected" in events[1]["error"]["message"]


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

    events_dir = temp_dir / LIVE_EVENTS_DIR
    events_dir.mkdir()

    stream = LiveStream(temp_dir, poll_interval=0.05, watcher_task=watcher_task)

    # Write a sessionEnd event.
    _write_event(events_dir, 0, {
        "type": "sessionEnd",
        "status": "completed",
    })

    # Drain the stream.
    events = []
    async for event in stream:
        events.append(event)

    assert len(events) == 2  # sendRequest (flush) + complete
    assert "sendRequest" in events[0]
    assert "complete" in events[1]

    # Give a tick for the cancellation to propagate.
    await asyncio.sleep(0.05)
    assert watcher_task.cancelled() or watcher_task.done()

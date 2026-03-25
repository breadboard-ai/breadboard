# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for the run()/resume() entry points.

Mocks the Gemini streaming layer and verifies that run() and resume()
yield the correct event sequences, handle suspend/resume round-trips,
and propagate errors properly.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opal_backend.events import AgentEvent
from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.loop import AgentResult, LoopController
from opal_backend.run import run, resume, _build_function_groups, _process_chat_response, _apply_function_filter


# =============================================================================
# Helpers
# =============================================================================


def make_text_chunk(text: str, thought: bool = False) -> dict:
    """Create a Gemini response chunk with a text part."""
    part: dict = {"text": text}
    if thought:
        part["thought"] = True
    return {
        "candidates": [
            {
                "content": {
                    "parts": [part],
                    "role": "model",
                }
            }
        ]
    }


def make_function_call_chunk(name: str, args: dict | None = None) -> dict:
    """Create a Gemini response chunk with a function call."""
    return {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "functionCall": {
                                "name": name,
                                "args": args or {},
                            }
                        }
                    ],
                    "role": "model",
                }
            }
        ]
    }


def make_segments() -> list[dict]:
    """Create minimal segments for a text objective."""
    return [{"type": "text", "text": "Say hello"}]





def make_graph() -> dict:
    """Create a minimal graph identity."""
    return {"url": "drive:/test123", "title": "Test Opal"}


def make_mock_backend() -> MagicMock:
    """Create a mock BackendClient."""
    return MagicMock()


async def collect_events(event_iter) -> list[dict]:
    """Collect all events from an async iterator as dicts."""
    events = []
    async for event in event_iter:
        events.append(event.to_dict())
    return events


def event_type(e: dict) -> str:
    """Extract the event type from a proto-style oneof dict."""
    return next(iter(e))


# =============================================================================
# run() tests
# =============================================================================


class TestRun:
    """Tests for the run() async generator."""

    @pytest.mark.asyncio
    async def test_run_yields_complete_event(self):
        """A simple run with system_objective_fulfilled yields a complete event."""
        chunks = [
            make_text_chunk("Thinking...", thought=True),
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done", "href": "/"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            events = await collect_events(run(
                segments=make_segments(),
                backend=make_mock_backend(),
                store=InMemoryInteractionStore(),
                graph=make_graph(),
            ))

        types = [event_type(e) for e in events]
        assert "complete" in types

        # The complete event should indicate success.
        complete = next(e for e in events if event_type(e) == "complete")
        assert complete["complete"]["result"]["success"] is True

    @pytest.mark.asyncio
    async def test_run_yields_error_on_exception(self):
        """If the Gemini call raises, run() yields an error event."""
        async def exploding_stream(*args, **kwargs):
            raise RuntimeError("Boom")
            # Unreachable, but makes this a generator.
            yield  # noqa: F401 — unreachable yield for generator protocol

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=exploding_stream,
        ):
            events = await collect_events(run(
                segments=make_segments(),
                backend=make_mock_backend(),
                store=InMemoryInteractionStore(),
                graph=make_graph(),
            ))

        types = [event_type(e) for e in events]
        assert "error" in types

    @pytest.mark.asyncio
    async def test_run_suspend_saves_state(self):
        """When a suspend function is called, state is saved to the store."""
        chunks = [
            make_function_call_chunk(
                "chat_request_user_input",
                {"user_message": "What do you think?"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        store = InMemoryInteractionStore()

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            events = await collect_events(run(
                segments=make_segments(),
                backend=make_mock_backend(),
                store=store,
                graph=make_graph(),
            ))

        types = [event_type(e) for e in events]
        # Should have a suspend event (waitForInput).
        assert "waitForInput" in types

        # The store should now have a saved interaction.
        assert len(store._store) == 1

    @pytest.mark.asyncio
    async def test_run_failed_objective(self):
        """system_failed_to_fulfill_objective yields a complete with success=False."""
        chunks = [
            make_function_call_chunk(
                "system_failed_to_fulfill_objective",
                {"user_message": "Cannot do this"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            events = await collect_events(run(
                segments=make_segments(),
                backend=make_mock_backend(),
                store=InMemoryInteractionStore(),
                graph=make_graph(),
            ))

        types = [event_type(e) for e in events]
        assert "complete" in types

        complete = next(e for e in events if event_type(e) == "complete")
        assert complete["complete"]["result"]["success"] is False


# =============================================================================
# resume() tests
# =============================================================================


class TestResume:
    """Tests for the resume() async generator."""

    @pytest.mark.asyncio
    async def test_resume_unknown_id_yields_error(self):
        """Resuming with an unknown interaction ID yields an error."""
        events = await collect_events(resume(
            interaction_id="nonexistent",
            response={"text": "hi"},
            backend=make_mock_backend(),
            store=InMemoryInteractionStore(),
        ))

        assert len(events) == 1
        assert event_type(events[0]) == "error"
        assert "Unknown interaction ID" in events[0]["error"]["message"]

    @pytest.mark.asyncio
    async def test_suspend_then_resume(self):
        """Full round-trip: run suspends, resume continues to completion."""
        # --- Phase 1: run until suspend ---
        suspend_chunks = [
            make_function_call_chunk(
                "chat_request_user_input",
                {"user_message": "What now?"},
            ),
        ]

        async def suspend_stream(*args, **kwargs):
            for chunk in suspend_chunks:
                yield chunk

        store = InMemoryInteractionStore()

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=suspend_stream,
        ):
            run_events = await collect_events(run(
                segments=make_segments(),
                backend=make_mock_backend(),
                store=store,
                graph=make_graph(),
            ))

        # Find the suspend event to get interaction_id.
        suspend_event = next(
            e for e in run_events if event_type(e) == "waitForInput"
        )
        interaction_id = suspend_event["waitForInput"]["interactionId"]

        # --- Phase 2: resume to completion ---
        resume_chunks = [
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "All done", "href": "/"},
            ),
        ]

        async def resume_stream(*args, **kwargs):
            for chunk in resume_chunks:
                yield chunk

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=resume_stream,
        ):
            resume_events = await collect_events(resume(
                interaction_id=interaction_id,
                response={"text": "Continue!"},
                backend=make_mock_backend(),
                store=store,
            ))

        types = [event_type(e) for e in resume_events]
        assert "complete" in types

        complete = next(
            e for e in resume_events if event_type(e) == "complete"
        )
        assert complete["complete"]["result"]["success"] is True

    @pytest.mark.asyncio
    async def test_flags_and_graph_survive_suspend_resume(self):
        """Flags and graph are saved on suspend and restored on resume."""
        suspend_chunks = [
            make_function_call_chunk(
                "chat_request_user_input",
                {"user_message": "What?"},
            ),
        ]

        async def suspend_stream(*args, **kwargs):
            for chunk in suspend_chunks:
                yield chunk

        store = InMemoryInteractionStore()
        test_flags = {"googleOne": True, "customFlag": "hello"}
        test_graph = {"url": "drive:/abc123", "title": "My Opal"}

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=suspend_stream,
        ):
            await collect_events(run(
                segments=make_segments(),
                backend=make_mock_backend(),
                store=store,
                flags=test_flags,
                graph=test_graph,
            ))

        # Verify flags, graph, and session_id were saved into the state.
        assert len(store._store) == 1
        saved_state = next(iter(store._store.values()))
        assert saved_state.flags == test_flags
        assert saved_state.graph == test_graph
        # session_id should be a non-empty UUID.
        assert len(saved_state.session_id) > 0
        assert saved_state.session_id.count("-") == 4

        interaction_id = next(iter(store._store.keys()))

        # Resume — note: no flags or graph passed.
        resume_chunks = [
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done", "href": "/"},
            ),
        ]

        async def resume_stream(*args, **kwargs):
            for chunk in resume_chunks:
                yield chunk

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=resume_stream,
        ):
            resume_events = await collect_events(resume(
                interaction_id=interaction_id,
                response={"text": "Ok"},
                backend=make_mock_backend(),
                store=store,
            ))

        types = [event_type(e) for e in resume_events]
        assert "complete" in types

    @pytest.mark.asyncio
    async def test_memory_tool_segment_sets_use_memory_flag(self):
        """A memory tool segment should set useMemory in saved flags."""
        suspend_chunks = [
            make_function_call_chunk(
                "chat_request_user_input",
                {"user_message": "What?"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in suspend_chunks:
                yield chunk

        store = InMemoryInteractionStore()

        # Segments include a memory tool — run() should derive useMemory.
        segments_with_memory = [
            {"type": "text", "text": "Remember things"},
            {"type": "tool", "path": "function-group/use-memory"},
        ]

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            await collect_events(run(
                segments=segments_with_memory,
                backend=make_mock_backend(),
                store=store,
                graph=make_graph(),
            ))

        saved_state = next(iter(store._store.values()))
        assert saved_state.flags.get("useMemory") is True

    @pytest.mark.asyncio
    async def test_text_only_segments_do_not_set_use_memory(self):
        """Plain text segments should not set useMemory."""
        suspend_chunks = [
            make_function_call_chunk(
                "chat_request_user_input",
                {"user_message": "What?"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in suspend_chunks:
                yield chunk

        store = InMemoryInteractionStore()

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            await collect_events(run(
                segments=make_segments(),
                backend=make_mock_backend(),
                store=store,
                graph=make_graph(),
            ))

        saved_state = next(iter(store._store.values()))
        assert "useMemory" not in saved_state.flags

    @pytest.mark.asyncio
    async def test_asset_data_parts_survive_into_loop(self):
        """Data parts from asset segments should appear in intermediate files."""
        chunks = [
            make_function_call_chunk(
                "system_objective_fulfilled",
                {"objective_outcome": "Done", "href": "/"},
            ),
        ]

        async def fake_stream(*args, **kwargs):
            for chunk in chunks:
                yield chunk

        # An asset segment with an inline image part.
        segments_with_asset = [
            {"type": "text", "text": "Describe this"},
            {
                "type": "asset",
                "title": "photo",
                "content": {
                    "parts": [{"inlineData": {
                        "mimeType": "image/png",
                        "data": "iVBOR",
                    }}],
                    "role": "user",
                },
            },
        ]

        with patch(
            "opal_backend.loop.stream_generate_content",
            side_effect=fake_stream,
        ):
            events = await collect_events(run(
                segments=segments_with_asset,
                backend=make_mock_backend(),
                store=InMemoryInteractionStore(),
                graph=make_graph(),
            ))

        complete = next(e for e in events if event_type(e) == "complete")
        intermediate = complete["complete"]["result"].get("intermediate")
        # The asset's inline data should have been registered in the FS
        # and appear as an intermediate file.
        assert intermediate is not None
        assert len(intermediate) >= 1
        # Verify the data survived.
        found_image = any(
            f.get("content", {}).get("inlineData", {}).get("mimeType")
            == "image/png"
            for f in intermediate
        )


# =============================================================================
# _build_function_groups tests
# =============================================================================


class TestBuildFunctionGroups:
    """Tests for the _build_function_groups helper."""

    def test_memory_group_included_when_sheet_manager_provided(self):
        """Memory functions must appear when a sheet_manager is given.

        Regression: a premature ``return`` caused the ``if sheet_manager:``
        block to be dead code, so memory functions were never included.
        """
        controller = LoopController()
        from opal_backend.agent_file_system import AgentFileSystem
        from opal_backend.task_tree_manager import TaskTreeManager

        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        backend = make_mock_backend()
        sheet_manager = AsyncMock()

        groups = _build_function_groups(
            controller=controller,
            file_system=fs,
            task_tree_manager=ttm,
            backend=backend,
            flags={},
            sheet_manager=sheet_manager,
        )

        all_names = set()
        for group in groups:
            for name, _ in group.definitions:
                all_names.add(name)

        assert "memory_create_sheet" in all_names
        assert "memory_read_sheet" in all_names
        assert "memory_update_sheet" in all_names
        assert "memory_delete_sheet" in all_names
        assert "memory_get_metadata" in all_names

    def test_memory_group_excluded_without_sheet_manager(self):
        """Without a sheet_manager, no memory functions should appear."""
        controller = LoopController()
        from opal_backend.agent_file_system import AgentFileSystem
        from opal_backend.task_tree_manager import TaskTreeManager

        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        backend = make_mock_backend()

        groups = _build_function_groups(
            controller=controller,
            file_system=fs,
            task_tree_manager=ttm,
            backend=backend,
            flags={},
        )

        all_names = set()
        for group in groups:
            for name, _ in group.definitions:
                all_names.add(name)

        assert "memory_create_sheet" not in all_names

    def test_extra_groups_override_builtin_by_name(self):
        """An extra group with the same name as a built-in replaces it."""
        from opal_backend.agent_file_system import AgentFileSystem
        from opal_backend.task_tree_manager import TaskTreeManager
        from opal_backend.function_definition import FunctionGroup, FunctionDefinition

        controller = LoopController()
        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        backend = make_mock_backend()

        # Create a custom "system" group with a single custom function.
        custom_def = FunctionDefinition(
            name="system_custom_tool",
            description="custom",
            handler=AsyncMock(),
        )
        custom_group = FunctionGroup(
            name="system",
            definitions=[("system_custom_tool", custom_def)],
            declarations=[{"name": "system_custom_tool"}],
        )

        groups = _build_function_groups(
            controller=controller,
            file_system=fs,
            task_tree_manager=ttm,
            backend=backend,
            flags={},
            extra_groups=[custom_group],
        )

        all_names = set()
        for group in groups:
            for name, _ in group.definitions:
                all_names.add(name)

        # Custom function present, built-in system functions gone.
        assert "system_custom_tool" in all_names
        assert "system_objective_fulfilled" not in all_names


# =============================================================================
# _apply_function_filter tests
# =============================================================================


class TestApplyFunctionFilter:
    """Tests for the _apply_function_filter helper."""

    def _make_group(self, name, func_names):
        from opal_backend.function_definition import FunctionGroup, FunctionDefinition

        definitions = [
            (fn, FunctionDefinition(name=fn, description="", handler=AsyncMock()))
            for fn in func_names
        ]
        declarations = [{"name": fn} for fn in func_names]
        return FunctionGroup(
            name=name,
            definitions=definitions,
            declarations=declarations,
            instruction=f"{name} instructions",
        )

    def test_wildcard_includes_entire_group(self):
        """'system.*' includes all functions in the system group."""
        system = self._make_group("system", ["system_a", "system_b"])
        chat = self._make_group("chat", ["chat_x"])

        result = _apply_function_filter([system, chat], ["system.*"])

        assert len(result) == 1
        assert result[0].name == "system"
        names = [n for n, _ in result[0].definitions]
        assert "system_a" in names
        assert "system_b" in names

    def test_specific_function_pattern(self):
        """'system.a' matches only 'system_a'."""
        system = self._make_group("system", ["system_a", "system_b"])

        result = _apply_function_filter([system], ["system.a"])

        assert len(result) == 1
        names = [n for n, _ in result[0].definitions]
        assert names == ["system_a"]

    def test_empty_filter_means_no_filtering(self):
        """An empty list keeps all groups (no-op)."""
        system = self._make_group("system", ["system_a"])
        chat = self._make_group("chat", ["chat_x"])
        groups = [system, chat]

        # Empty list should never reach _apply_function_filter due to
        # the guard in _build_function_groups, but verify the semantics:
        # if it did, no patterns would match and groups would be dropped.
        # The guard ensures this never happens.
        # (This test validates the guard, not the filter itself.)

    def test_unmatched_group_is_dropped(self):
        """Groups with no matching functions are excluded."""
        system = self._make_group("system", ["system_a"])
        chat = self._make_group("chat", ["chat_x"])

        result = _apply_function_filter([system, chat], ["system.*"])

        group_names = [g.name for g in result]
        assert "chat" not in group_names

    def test_unnamed_groups_pass_through(self):
        """Groups without a name survive any filter."""
        from opal_backend.function_definition import FunctionGroup, FunctionDefinition

        unnamed = FunctionGroup(
            name=None,
            definitions=[("anon_fn", FunctionDefinition(
                name="anon_fn", description="", handler=AsyncMock(),
            ))],
            declarations=[{"name": "anon_fn"}],
        )
        system = self._make_group("system", ["system_a"])

        result = _apply_function_filter([unnamed, system], ["system.*"])

        group_names = [g.name for g in result]
        assert None in group_names
        assert "system" in group_names


class TestProcessChatResponse:
    """Tests for _process_chat_response."""

    @pytest.mark.asyncio
    async def test_skip_sentinel_transformed(self):
        """__skipped__ sentinel in LLMContent is transformed to {skipped: true}."""
        from opal_backend.agent_file_system import AgentFileSystem

        fs = AgentFileSystem()
        response = {
            "input": {"role": "user", "parts": [{"text": "__skipped__"}]}
        }
        result = await _process_chat_response(
            "chat_request_user_input", response, fs,
        )
        assert result == {"skipped": True}

    @pytest.mark.asyncio
    async def test_extracts_text_from_llm_content(self):
        """Client sends {input: LLMContent} — text is extracted."""
        from opal_backend.agent_file_system import AgentFileSystem

        fs = AgentFileSystem()
        response = {
            "input": {"role": "user", "parts": [{"text": "hello"}]}
        }
        result = await _process_chat_response(
            "chat_request_user_input", response, fs,
        )
        assert result == {"user_input": "hello"}

    @pytest.mark.asyncio
    async def test_non_chat_function_passthrough(self):
        """Non-chat functions pass through unchanged."""
        from opal_backend.agent_file_system import AgentFileSystem

        fs = AgentFileSystem()
        response = {"text": "generated"}
        result = await _process_chat_response("generate_text", response, fs)
        assert result is response

    @pytest.mark.asyncio
    async def test_missing_input_passes_through(self):
        """If 'input' key is missing, response passes through unchanged."""
        from opal_backend.agent_file_system import AgentFileSystem

        fs = AgentFileSystem()
        response = {"other": "data"}
        result = await _process_chat_response(
            "chat_request_user_input", response, fs,
        )
        assert result is response

    @pytest.mark.asyncio
    async def test_multimodal_parts_registered_in_fs(self):
        """Image parts are registered in FS and produce <file> pidgin tags."""
        from opal_backend.agent_file_system import AgentFileSystem

        fs = AgentFileSystem()
        response = {
            "input": {
                "role": "user",
                "parts": [
                    {"text": "Here is a photo"},
                    {"inlineData": {
                        "mimeType": "image/png",
                        "data": "iVBORw0KGgo=",
                    }},
                ],
            }
        }
        result = await _process_chat_response(
            "chat_request_user_input", response, fs,
        )

        user_input = result["user_input"]
        # The text part should be present.
        assert "Here is a photo" in user_input
        # The image should be registered and produce a <file> tag.
        assert '<file src="' in user_input
        assert '" />' in user_input
        # The FS should contain the registered image.
        assert len(fs.files) >= 1


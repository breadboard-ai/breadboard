# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the suspend/resume protocol primitives."""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from opal_backend.suspend import SuspendError, SuspendResult
from opal_backend.events import WaitForInputEvent
from opal_backend.interaction_store import InteractionState
from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.agent_file_system import (
    AgentFileSystem, FileDescriptor, FileSystemSnapshot,
)
from opal_backend.task_tree_manager import TaskTreeManager, TaskTreeSnapshot
from opal_backend.function_caller import FunctionCaller
from opal_backend.function_definition import FunctionDefinition
from opal_backend.loop import Loop, AgentRunArgs, LoopController


class TestSuspendError(unittest.TestCase):
    """Tests for SuspendError."""

    def test_creates_with_event_and_interaction_id(self):
        event = WaitForInputEvent(
            request_id="req-1", prompt={},
        )
        error = SuspendError(event)
        self.assertEqual(error.event, event)
        self.assertIsInstance(error.interaction_id, str)
        self.assertTrue(len(error.interaction_id) > 0)

    def test_unique_interaction_ids(self):
        e1 = SuspendError(WaitForInputEvent(request_id="a"))
        e2 = SuspendError(WaitForInputEvent(request_id="b"))
        self.assertNotEqual(e1.interaction_id, e2.interaction_id)

    def test_str_includes_event_type(self):
        from opal_backend.events import WaitForChoiceEvent
        error = SuspendError(WaitForChoiceEvent(request_id="x"))
        self.assertIn("waitForChoice", str(error))


class TestInteractionStore:
    """Tests for InteractionStore."""

    def _make_state(self) -> InteractionState:
        fs = AgentFileSystem()
        fs.write("test.md", "hello world")
        ttm = TaskTreeManager(fs)
        return InteractionState(
            contents=[{"parts": [{"text": "hello"}], "role": "user"}],
            function_call_part={
                "functionCall": {"name": "test_fn", "args": {}}
            },
            file_system=fs.snapshot,
            task_tree=ttm.snapshot,
        )

    @pytest.mark.asyncio
    async def test_save_and_load(self):
        store = InMemoryInteractionStore()
        state = self._make_state()
        await store.save("int-1", state)
        loaded = await store.load("int-1")
        assert loaded is not None
        assert loaded.contents == state.contents
        assert loaded.function_call_part == state.function_call_part

    @pytest.mark.asyncio
    async def test_load_removes_entry(self):
        store = InMemoryInteractionStore()
        state = self._make_state()
        await store.save("int-1", state)
        await store.load("int-1")
        assert await store.load("int-1") is None

    @pytest.mark.asyncio
    async def test_load_unknown_returns_none(self):
        store = InMemoryInteractionStore()
        assert await store.load("unknown") is None

    @pytest.mark.asyncio
    async def test_has(self):
        store = InMemoryInteractionStore()
        state = self._make_state()
        assert not await store.has("int-1")
        await store.save("int-1", state)
        assert await store.has("int-1")

    @pytest.mark.asyncio
    async def test_clear(self):
        store = InMemoryInteractionStore()
        await store.save("a", self._make_state())
        await store.save("b", self._make_state())
        await store.clear()
        assert not await store.has("a")
        assert not await store.has("b")

    @pytest.mark.asyncio
    async def test_round_trip_serialization(self):
        """to_dict → from_dict produces equivalent state."""
        state = self._make_state()
        state.flags = {"enableFeature": True}
        state.graph = {"url": "drive:/abc", "title": "Test"}
        state.consents_granted = {"GET_ANY_WEBPAGE"}

        data = state.to_dict()
        restored = InteractionState.from_dict(data)

        assert restored.contents == state.contents
        assert restored.function_call_part == state.function_call_part
        assert restored.flags == state.flags
        assert restored.graph == state.graph
        assert restored.session_id == state.session_id
        assert restored.is_precondition_check == state.is_precondition_check
        assert restored.consents_granted == state.consents_granted

        # Snapshot data equality.
        assert restored.file_system.file_count == state.file_system.file_count
        assert restored.file_system.routes == state.file_system.routes
        assert len(restored.file_system.files) == len(state.file_system.files)
        for path, fd in restored.file_system.files.items():
            orig = state.file_system.files[path]
            assert fd.data == orig.data
            assert fd.mime_type == orig.mime_type
            assert fd.type == orig.type

        assert restored.task_tree.tree == state.task_tree.tree

    @pytest.mark.asyncio
    async def test_round_trip_with_task_tree(self):
        """Task tree snapshot survives serialization."""
        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        tree = {
            "task_id": "task_001",
            "description": "Root",
            "execution_mode": "serial",
            "status": "in_progress",
            "subtasks": [{
                "task_id": "task_002",
                "description": "Child",
                "execution_mode": "serial",
                "status": "not_started",
            }],
        }
        ttm.set(tree)

        state = InteractionState(
            contents=[{"parts": [{"text": "obj"}], "role": "user"}],
            function_call_part={"functionCall": {"name": "fn", "args": {}}},
            file_system=fs.snapshot,
            task_tree=ttm.snapshot,
        )

        data = state.to_dict()
        restored = InteractionState.from_dict(data)

        assert restored.task_tree.tree == tree

        # Verify live TaskTreeManager can be reconstructed.
        live_fs = AgentFileSystem.from_snapshot(restored.file_system)
        live_ttm = TaskTreeManager.from_snapshot(restored.task_tree, live_fs)
        assert live_ttm.get() != ""  # tree is populated


class TestFunctionCallerSuspend(unittest.TestCase):
    """Tests that SuspendError propagates through FunctionCaller."""

    def test_suspend_error_propagates(self):
        """SuspendError should not be caught as a generic exception."""
        suspend_event = WaitForInputEvent(
            request_id="req-1",
        )

        async def suspending_handler(args, status_cb):
            raise SuspendError(suspend_event)

        defn = FunctionDefinition(
            name="test_suspend",
            description="A test function that suspends",
            handler=suspending_handler,
        )

        async def run():
            caller = FunctionCaller({"test_suspend": defn})
            caller.call(
                "call-1",
                {"functionCall": {"name": "test_suspend", "args": {}}},
            )
            with self.assertRaises(SuspendError) as ctx:
                await caller.get_results()
            self.assertEqual(ctx.exception.event, suspend_event)

        asyncio.run(run())


class TestLoopSuspend(unittest.TestCase):
    """Tests that the Loop returns SuspendResult on SuspendError."""

    def test_loop_returns_suspend_result(self):
        """When a function raises SuspendError, loop returns SuspendResult."""
        suspend_event = WaitForInputEvent(
            request_id="req-1",
            prompt={"parts": [{"text": "What is your name?"}]},
        )
        function_call_part = {
            "functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": "What is your name?"},
            }
        }

        async def suspending_handler(args, status_cb):
            raise SuspendError(suspend_event, function_call_part)

        defn = FunctionDefinition(
            name="chat_request_user_input",
            description="Request user input",
            handler=suspending_handler,
        )

        from opal_backend.function_definition import FunctionGroup

        group = FunctionGroup(
            instruction="Test instruction",
            definitions=[("chat_request_user_input", defn)],
            declarations=[{
                "name": "chat_request_user_input",
                "description": "Request user input",
            }],
        )

        # Mock Gemini to return a function call.
        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "functionCall": {
                            "name": "chat_request_user_input",
                            "args": {"user_message": "What is your name?"},
                        }
                    }],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        objective = {
            "parts": [{"text": "Ask the user their name"}],
            "role": "user",
        }

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=objective,
                        function_groups=[group],
                    )
                )
                self.assertIsInstance(result, SuspendResult)
                self.assertEqual(result.suspend_event.type, "waitForInput")
                self.assertIsInstance(result.interaction_id, str)
                # Contents should include the objective + model's function call
                self.assertTrue(len(result.contents) >= 2)

        asyncio.run(run())

    def test_loop_resumes_with_contents(self):
        """Loop can be resumed with saved contents + injected response."""
        # Simulate a resumed run where the conversation already includes
        # the original objective + model's function call + user's response.
        # The loop should continue from that point.

        # First turn: model calls system_objective_fulfilled
        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "functionCall": {
                            "name": "system_objective_fulfilled",
                            "args": {"outcome_text": "Done!"},
                        }
                    }],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        controller = LoopController()

        # The system function terminates the loop.
        async def fulfill_handler(args, status_cb):
            from opal_backend.loop import AgentResult
            controller.terminate(AgentResult(
                success=True,
                outcomes={"parts": [{"text": "Done!"}], "role": "model"},
            ))
            return {"success": True}

        defn = FunctionDefinition(
            name="system_objective_fulfilled",
            description="Objective fulfilled",
            handler=fulfill_handler,
        )

        from opal_backend.function_definition import FunctionGroup

        group = FunctionGroup(
            instruction="",
            definitions=[("system_objective_fulfilled", defn)],
            declarations=[{
                "name": "system_objective_fulfilled",
                "description": "Objective fulfilled",
            }],
        )

        # Pre-built contents simulating a resumed conversation.
        saved_contents = [
            {"parts": [{"text": "original objective"}], "role": "user"},
            {"parts": [{"functionCall": {"name": "ask_user", "args": {}}}], "role": "model"},
            {"parts": [{"functionResponse": {"name": "ask_user", "response": {"user_input": "Bob"}}}], "role": "user"},
        ]

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(controller=controller, backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=saved_contents[0],
                        function_groups=[group],
                        contents=saved_contents,
                    )
                )
                # Should complete normally (not suspend).
                self.assertNotIsInstance(result, SuspendResult)
                from opal_backend.loop import AgentResult
                self.assertIsInstance(result, AgentResult)
                self.assertTrue(result.success)

        asyncio.run(run())

    def test_on_finish_not_called_on_suspend(self):
        """on_finish must NOT fire when the loop suspends."""
        suspend_event = WaitForInputEvent(
            request_id="req-1",
            prompt={"parts": [{"text": "Name?"}]},
        )
        function_call_part = {
            "functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": "Name?"},
            }
        }

        async def suspending_handler(args, status_cb):
            raise SuspendError(suspend_event, function_call_part)

        defn = FunctionDefinition(
            name="chat_request_user_input",
            description="Request user input",
            handler=suspending_handler,
        )

        from opal_backend.function_definition import FunctionGroup
        from opal_backend.loop import LoopHooks

        group = FunctionGroup(
            instruction="",
            definitions=[("chat_request_user_input", defn)],
            declarations=[{
                "name": "chat_request_user_input",
                "description": "Request user input",
            }],
        )

        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "functionCall": {
                            "name": "chat_request_user_input",
                            "args": {"user_message": "Name?"},
                        }
                    }],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        on_start_calls = []
        on_finish_calls = []

        objective = {
            "parts": [{"text": "Ask name"}],
            "role": "user",
        }

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=objective,
                        function_groups=[group],
                        hooks=LoopHooks(
                            on_start=lambda obj: on_start_calls.append(obj),
                            on_finish=lambda: on_finish_calls.append(True),
                        ),
                    )
                )
                self.assertIsInstance(result, SuspendResult)
                # on_start should fire (this is a fresh run).
                self.assertEqual(len(on_start_calls), 1)
                # on_finish must NOT fire — the agent is paused, not done.
                self.assertEqual(len(on_finish_calls), 0)

        asyncio.run(run())

    def test_on_start_not_called_on_resume(self):
        """on_start must NOT fire for resumed runs (pre-populated contents)."""
        controller = LoopController()

        async def fulfill_handler(args, status_cb):
            from opal_backend.loop import AgentResult
            controller.terminate(AgentResult(
                success=True,
                outcomes={"parts": [{"text": "Done!"}], "role": "model"},
            ))
            return {"success": True}

        defn = FunctionDefinition(
            name="system_objective_fulfilled",
            description="Objective fulfilled",
            handler=fulfill_handler,
        )

        from opal_backend.function_definition import FunctionGroup
        from opal_backend.loop import LoopHooks

        group = FunctionGroup(
            instruction="",
            definitions=[("system_objective_fulfilled", defn)],
            declarations=[{
                "name": "system_objective_fulfilled",
                "description": "Objective fulfilled",
            }],
        )

        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "functionCall": {
                            "name": "system_objective_fulfilled",
                            "args": {"outcome_text": "Done!"},
                        }
                    }],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        on_start_calls = []
        on_finish_calls = []

        saved_contents = [
            {"parts": [{"text": "original objective"}], "role": "user"},
            {"parts": [{"functionCall": {"name": "ask", "args": {}}}], "role": "model"},
            {"parts": [{"functionResponse": {"name": "ask", "response": {"input": "Bob"}}}], "role": "user"},
        ]

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(controller=controller, backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=saved_contents[0],
                        function_groups=[group],
                        contents=saved_contents,
                        hooks=LoopHooks(
                            on_start=lambda obj: on_start_calls.append(obj),
                            on_finish=lambda: on_finish_calls.append(True),
                        ),
                    )
                )
                from opal_backend.loop import AgentResult
                self.assertIsInstance(result, AgentResult)
                # on_start must NOT fire — this is a resumed run.
                self.assertEqual(len(on_start_calls), 0)
                # on_finish SHOULD fire — the run completed normally.
                self.assertEqual(len(on_finish_calls), 1)

        asyncio.run(run())

    def test_siblings_complete_on_suspend(self):
        """When one function suspends, sibling tasks run to completion.

        Suspend means "wait for external input" — it is NOT a "stop the
        train" signal.  Sibling functions should finish and their results
        should be captured in the SuspendResult.
        """
        suspend_event = WaitForInputEvent(
            request_id="req-1",
            prompt={"parts": [{"text": "Name?"}]},
        )
        function_call_part = {
            "functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": "Name?"},
            }
        }

        sibling_completed = False

        async def suspending_handler(args, status_cb):
            raise SuspendError(suspend_event, function_call_part)

        async def fast_handler(args, status_cb):
            nonlocal sibling_completed
            sibling_completed = True
            return {"result": "done"}

        suspend_defn = FunctionDefinition(
            name="chat_request_user_input",
            description="Request user input",
            handler=suspending_handler,
        )
        fast_defn = FunctionDefinition(
            name="coordination_emit",
            description="Emit signal",
            handler=fast_handler,
        )

        from opal_backend.function_definition import FunctionGroup

        group = FunctionGroup(
            instruction="",
            definitions=[
                ("chat_request_user_input", suspend_defn),
                ("coordination_emit", fast_defn),
            ],
            declarations=[
                {"name": "chat_request_user_input", "description": "Input"},
                {"name": "coordination_emit", "description": "Emit"},
            ],
        )

        # Gemini returns both function calls in one chunk (concurrent).
        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [
                        {
                            "functionCall": {
                                "name": "coordination_emit",
                                "args": {},
                            }
                        },
                        {
                            "functionCall": {
                                "name": "chat_request_user_input",
                                "args": {"user_message": "Name?"},
                            }
                        },
                    ],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        objective = {
            "parts": [{"text": "Test siblings"}],
            "role": "user",
        }

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=objective,
                        function_groups=[group],
                    )
                )
                self.assertIsInstance(result, SuspendResult)
                # The sibling MUST have completed (not cancelled).
                self.assertTrue(sibling_completed)
                # Completed sibling response must be in the result.
                self.assertEqual(
                    len(result.completed_function_responses), 1,
                )
                resp = result.completed_function_responses[0]
                self.assertEqual(
                    resp["functionResponse"]["name"],
                    "coordination_emit",
                )

        asyncio.run(run())

    def test_completed_sibling_emits_result_on_suspend(self):
        """Completed sibling functions emit on_function_result on suspend.

        When create_task_tree completes before a sibling function suspends
        (e.g. consent precondition), on_function_result must fire for the
        completed function so the client sees a matching FunctionResultEvent.
        """
        from opal_backend.events import QueryConsentEvent
        from opal_backend.function_definition import FunctionGroup
        from opal_backend.loop import LoopHooks

        consent_event = QueryConsentEvent(
            request_id="req-consent",
            consent_type="GET_ANY_WEBPAGE",
        )
        function_call_part = {
            "functionCall": {
                "name": "generate_text",
                "args": {"url_context": True},
            }
        }

        async def fast_handler(args, status_cb):
            return {"file_path": "/mnt/task-tree.json"}

        async def precondition(args):
            # Yield control so the fast sibling can complete first.
            await asyncio.sleep(0)
            raise SuspendError(
                consent_event,
                function_call_part,
                is_precondition_check=True,
            )

        async def suspending_handler(args, status_cb):
            return {"text": "never reached"}

        fast_defn = FunctionDefinition(
            name="system_create_task_tree",
            description="Create a task tree",
            handler=fast_handler,
        )
        suspend_defn = FunctionDefinition(
            name="generate_text",
            description="Generate text",
            handler=suspending_handler,
            precondition=precondition,
        )

        group = FunctionGroup(
            instruction="",
            definitions=[
                ("system_create_task_tree", fast_defn),
                ("generate_text", suspend_defn),
            ],
            declarations=[
                {"name": "system_create_task_tree", "description": "Task tree"},
                {"name": "generate_text", "description": "Generate"},
            ],
        )

        # Gemini returns both function calls in one chunk.
        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [
                        {
                            "functionCall": {
                                "name": "system_create_task_tree",
                                "args": {"task_tree": {"tasks": []}},
                            }
                        },
                        {
                            "functionCall": {
                                "name": "generate_text",
                                "args": {"url_context": True},
                            }
                        },
                    ],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        objective = {
            "parts": [{"text": "Test sibling result on suspend"}],
            "role": "user",
        }

        function_call_ids: list[str] = []
        function_result_ids: list[str] = []

        def on_function_call(part, icon=None, title=None):
            import uuid
            call_id = str(uuid.uuid4())
            function_call_ids.append(call_id)
            return {"callId": call_id, "reporter": None}

        def on_function_result(call_id, content):
            function_result_ids.append(call_id)

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=objective,
                        function_groups=[group],
                        hooks=LoopHooks(
                            on_function_call=on_function_call,
                            on_function_result=on_function_result,
                        ),
                    )
                )
                self.assertIsInstance(result, SuspendResult)
                # Both function calls should have been reported.
                self.assertEqual(len(function_call_ids), 2)
                # The fast sibling (create_task_tree) should have its
                # result emitted even though the turn ended with a suspend.
                self.assertEqual(len(function_result_ids), 1)
                # The emitted result must match one of the call IDs.
                self.assertIn(function_result_ids[0], function_call_ids)

        asyncio.run(run())


class TestPreconditionSuspend(unittest.TestCase):
    """Tests for precondition-based suspend/resume."""

    def test_precondition_suspend_propagates_through_caller(self):
        """SuspendError from a precondition propagates with is_precondition_check."""
        from opal_backend.events import QueryConsentEvent

        consent_event = QueryConsentEvent(
            request_id="req-consent",
            consent_type="GET_ANY_WEBPAGE",
            scope={},
            graph_url="https://example.com/graph",
        )

        async def precondition(args):
            raise SuspendError(
                consent_event,
                {"functionCall": {"name": "generate_text", "args": args}},
                is_precondition_check=True,
            )

        async def handler(args, status_cb):
            return {"text": "should not be called"}

        defn = FunctionDefinition(
            name="generate_text",
            description="Generate text",
            handler=handler,
            precondition=precondition,
        )

        async def run():
            caller = FunctionCaller({"generate_text": defn})
            caller.call(
                "call-1",
                {"functionCall": {"name": "generate_text", "args": {"url_context": True}}},
            )
            with self.assertRaises(SuspendError) as ctx:
                await caller.get_results()
            self.assertTrue(ctx.exception.is_precondition_check)
            self.assertIsInstance(ctx.exception.event, QueryConsentEvent)

        asyncio.run(run())

    def test_loop_suspend_result_has_precondition_flag(self):
        """Loop SuspendResult carries is_precondition_check flag."""
        from opal_backend.events import QueryConsentEvent
        from opal_backend.function_definition import FunctionGroup

        consent_event = QueryConsentEvent(
            request_id="req-consent",
            consent_type="GET_ANY_WEBPAGE",
        )
        function_call_part = {
            "functionCall": {
                "name": "generate_text",
                "args": {"url_context": True, "prompt": "test"},
            }
        }

        async def precondition(args):
            raise SuspendError(
                consent_event,
                function_call_part,
                is_precondition_check=True,
            )

        async def handler(args, status_cb):
            return {"text": "never reached"}

        defn = FunctionDefinition(
            name="generate_text",
            description="Generate text",
            handler=handler,
            precondition=precondition,
        )
        group = FunctionGroup(
            instruction="Test",
            definitions=[("generate_text", defn)],
            declarations=[{"name": "generate_text", "description": "Generate text"}],
        )

        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "functionCall": {
                            "name": "generate_text",
                            "args": {"url_context": True, "prompt": "test"},
                        }
                    }],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        objective = {
            "parts": [{"text": "Test objective"}],
            "role": "user",
        }

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=objective,
                        function_groups=[group],
                    )
                )
                self.assertIsInstance(result, SuspendResult)
                self.assertTrue(result.is_precondition_check)
                self.assertEqual(result.suspend_event.type, "queryConsent")

        asyncio.run(run())

    def test_precondition_passes_when_condition_met(self):
        """When precondition passes, handler runs normally."""
        handler_called = False

        async def precondition(args):
            # Condition is met — no raise.
            pass

        async def handler(args, status_cb):
            nonlocal handler_called
            handler_called = True
            return {"text": "success"}

        defn = FunctionDefinition(
            name="test_fn",
            description="Test",
            handler=handler,
            precondition=precondition,
        )

        async def run():
            caller = FunctionCaller({"test_fn": defn})
            caller.call(
                "call-1",
                {"functionCall": {"name": "test_fn", "args": {}}},
            )
            results = await caller.get_results()
            self.assertTrue(handler_called)
            self.assertIsNotNone(results)

        asyncio.run(run())


class TestFunctionCallerSiblingResults(unittest.TestCase):
    """Tests that FunctionCaller preserves completed sibling results on suspend.

    Suspend means "wait for external input" — sibling tasks must run to
    completion and their results must be attached to the SuspendError so
    the loop can include them in the saved state.
    """

    def test_completed_siblings_attached_to_suspend(self):
        """Completed siblings appear on SuspendError.completed_responses."""
        suspend_event = WaitForInputEvent(request_id="req-1")

        async def suspending(args, status_cb):
            raise SuspendError(
                suspend_event,
                {"functionCall": {"name": "chat", "args": args}},
            )

        async def fast_a(args, status_cb):
            return {"a": True}

        async def fast_b(args, status_cb):
            return {"b": True}

        defs = {
            "chat": FunctionDefinition(
                name="chat", description="", handler=suspending,
            ),
            "fn_a": FunctionDefinition(
                name="fn_a", description="", handler=fast_a,
            ),
            "fn_b": FunctionDefinition(
                name="fn_b", description="", handler=fast_b,
            ),
        }

        async def run():
            caller = FunctionCaller(defs)
            caller.call("c1", {"functionCall": {"name": "fn_a", "args": {}}})
            caller.call("c2", {"functionCall": {"name": "chat", "args": {}}})
            caller.call("c3", {"functionCall": {"name": "fn_b", "args": {}}})

            with self.assertRaises(SuspendError) as ctx:
                await caller.get_results()

            err = ctx.exception
            # Both non-suspending siblings must have completed.
            self.assertEqual(len(err.completed_responses), 2)
            names = {
                r.response["functionResponse"]["name"]
                for r in err.completed_responses
            }
            self.assertEqual(names, {"fn_a", "fn_b"})

        asyncio.run(run())

    def test_multiple_suspends_first_wins(self):
        """When two functions suspend, the first wins; the second gets an error response."""
        event_a = WaitForInputEvent(request_id="req-a")
        event_b = WaitForInputEvent(request_id="req-b")

        async def suspend_a(args, status_cb):
            raise SuspendError(
                event_a,
                {"functionCall": {"name": "chat_a", "args": {}}},
            )

        async def suspend_b(args, status_cb):
            # Yield briefly so suspend_a fires first.
            await asyncio.sleep(0)
            raise SuspendError(
                event_b,
                {"functionCall": {"name": "chat_b", "args": {}}},
            )

        defs = {
            "chat_a": FunctionDefinition(
                name="chat_a", description="", handler=suspend_a,
            ),
            "chat_b": FunctionDefinition(
                name="chat_b", description="", handler=suspend_b,
            ),
        }

        async def run():
            caller = FunctionCaller(defs)
            caller.call(
                "c1", {"functionCall": {"name": "chat_a", "args": {}}},
            )
            caller.call(
                "c2", {"functionCall": {"name": "chat_b", "args": {}}},
            )

            with self.assertRaises(SuspendError) as ctx:
                await caller.get_results()

            err = ctx.exception
            # First suspend wins.
            self.assertEqual(err.event.request_id, "req-a")
            # Second suspend becomes a synthetic error in completed_responses.
            self.assertEqual(len(err.completed_responses), 1)
            resp = err.completed_responses[0]
            self.assertIn(
                "error",
                resp.response["functionResponse"]["response"],
            )

        asyncio.run(run())


class TestCompletedResponsesSerialization(unittest.TestCase):
    """Tests that completed_function_responses round-trips through InteractionState."""

    def test_round_trip(self):
        """to_dict → from_dict preserves completed_function_responses."""
        sibling_responses = [
            {
                "functionResponse": {
                    "name": "coordination_emit",
                    "response": {"emitted": True},
                }
            },
            {
                "functionResponse": {
                    "name": "playbooks_run_playbook",
                    "response": {"playbook": "analysis", "tickets_created": 1},
                }
            },
        ]
        state = InteractionState(
            contents=[{"parts": [{"text": "obj"}], "role": "user"}],
            function_call_part={
                "functionCall": {"name": "chat_await", "args": {}}
            },
            file_system=None,
            task_tree=TaskTreeSnapshot(tree={}),
            completed_function_responses=sibling_responses,
        )

        data = state.to_dict()
        restored = InteractionState.from_dict(data)

        self.assertEqual(
            restored.completed_function_responses,
            sibling_responses,
        )

    def test_defaults_to_empty_for_old_state(self):
        """Old serialized state without the field gets an empty list."""
        data = {
            "contents": [],
            "function_call_part": {},
            "file_system": None,
            "task_tree": {"tree": {}},
        }
        restored = InteractionState.from_dict(data)
        self.assertEqual(restored.completed_function_responses, [])


class TestSuspendResumeWithSiblings(unittest.TestCase):
    """End-to-end: suspend with siblings → resume → combined user turn.

    Verifies that the resumed conversation contains a single user turn
    with ALL function responses (completed siblings + suspend response),
    so the model sees no orphaned function calls.
    """

    def test_resume_combines_sibling_and_suspend_responses(self):
        """Resumed contents have one user turn with all function responses."""
        # Simulate: model issued 3 function calls, one suspended.
        # Two siblings completed. Now we resume with the suspend response.
        suspend_event = WaitForInputEvent(request_id="req-1")
        function_call_part = {
            "functionCall": {
                "name": "chat_await_context_update",
                "args": {},
            }
        }

        sibling_completed = False

        async def suspending(args, status_cb):
            raise SuspendError(suspend_event, function_call_part)

        async def emit_handler(args, status_cb):
            return {"emitted": True}

        async def playbook_handler(args, status_cb):
            nonlocal sibling_completed
            sibling_completed = True
            return {"playbook": "analysis", "tickets_created": 1}

        suspend_defn = FunctionDefinition(
            name="chat_await_context_update",
            description="Await context", handler=suspending,
        )
        emit_defn = FunctionDefinition(
            name="coordination_emit",
            description="Emit", handler=emit_handler,
        )
        playbook_defn = FunctionDefinition(
            name="playbooks_run_playbook",
            description="Run playbook", handler=playbook_handler,
        )

        from opal_backend.function_definition import FunctionGroup
        from opal_backend.loop import LoopHooks

        group = FunctionGroup(
            instruction="",
            definitions=[
                ("chat_await_context_update", suspend_defn),
                ("coordination_emit", emit_defn),
                ("playbooks_run_playbook", playbook_defn),
            ],
            declarations=[
                {"name": "chat_await_context_update", "description": "Await"},
                {"name": "coordination_emit", "description": "Emit"},
                {"name": "playbooks_run_playbook", "description": "Playbook"},
            ],
        )

        # Model returns all three function calls.
        gemini_response = {
            "candidates": [{
                "content": {
                    "parts": [
                        {"functionCall": {"name": "coordination_emit", "args": {"signal_type": "building"}}},
                        {"functionCall": {"name": "playbooks_run_playbook", "args": {"name": "analysis"}}},
                        {"functionCall": {"name": "chat_await_context_update", "args": {}}},
                    ],
                    "role": "model",
                }
            }]
        }

        async def fake_stream(*_args, **_kwargs):
            yield gemini_response

        objective = {
            "parts": [{"text": "Orchestrate"}],
            "role": "user",
        }

        async def run():
            with patch(
                "opal_backend.loop.stream_generate_content",
                side_effect=fake_stream,
            ):
                loop = Loop(backend=MagicMock())
                result = await loop.run(
                    AgentRunArgs(
                        objective=objective,
                        function_groups=[group],
                    )
                )
                self.assertIsInstance(result, SuspendResult)
                self.assertTrue(sibling_completed)

                # --- Verify the SuspendResult carries sibling responses ---
                self.assertEqual(
                    len(result.completed_function_responses), 2,
                )
                sibling_names = {
                    r["functionResponse"]["name"]
                    for r in result.completed_function_responses
                }
                self.assertEqual(
                    sibling_names,
                    {"coordination_emit", "playbooks_run_playbook"},
                )

                # --- Simulate resume: build the combined user turn ---
                # This mirrors what run.py resume() does.
                all_parts = list(result.completed_function_responses)
                all_parts.append({
                    "functionResponse": {
                        "name": "chat_await_context_update",
                        "response": {"context_updates": ["tile ready"]},
                    }
                })
                combined_turn = {"parts": all_parts, "role": "user"}
                resumed_contents = result.contents + [combined_turn]

                # The last user turn must contain ALL three responses.
                last_user_turn = resumed_contents[-1]
                self.assertEqual(last_user_turn["role"], "user")
                response_names = {
                    p["functionResponse"]["name"]
                    for p in last_user_turn["parts"]
                    if "functionResponse" in p
                }
                self.assertEqual(
                    response_names,
                    {
                        "coordination_emit",
                        "playbooks_run_playbook",
                        "chat_await_context_update",
                    },
                )

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()

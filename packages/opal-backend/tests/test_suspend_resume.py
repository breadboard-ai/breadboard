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
from opal_backend.agent_file_system import AgentFileSystem
from opal_backend.task_tree_manager import TaskTreeManager
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
        ttm = TaskTreeManager(fs)
        return InteractionState(
            contents=[{"parts": [{"text": "hello"}], "role": "user"}],
            function_call_part={
                "functionCall": {"name": "test_fn", "args": {}}
            },
            file_system=fs,
            task_tree_manager=ttm,
        )

    @pytest.mark.asyncio
    async def test_save_and_load(self):
        store = InMemoryInteractionStore()
        state = self._make_state()
        await store.save("int-1", state)
        loaded = await store.load("int-1")
        assert loaded is state

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


if __name__ == "__main__":
    unittest.main()

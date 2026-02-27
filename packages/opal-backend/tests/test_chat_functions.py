# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for chat functions (suspend-based)."""

import asyncio
import unittest

from opal_backend.functions.chat import (
    get_chat_function_group,
    CHAT_REQUEST_USER_INPUT,
    CHAT_PRESENT_CHOICES,
)
from opal_backend.suspend import SuspendError
from opal_backend.agent_file_system import AgentFileSystem
from opal_backend.task_tree_manager import TaskTreeManager


class TestChatFunctionGroup(unittest.TestCase):
    """Tests for get_chat_function_group."""

    def test_returns_function_group(self):
        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        group = get_chat_function_group(task_tree_manager=ttm, file_system=fs)
        self.assertIsNotNone(group.instruction)
        self.assertTrue(len(group.definitions) == 2)
        self.assertTrue(len(group.declarations) == 2)

    def test_has_both_functions(self):
        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        group = get_chat_function_group(task_tree_manager=ttm, file_system=fs)
        names = [name for name, _ in group.definitions]
        self.assertIn(CHAT_REQUEST_USER_INPUT, names)
        self.assertIn(CHAT_PRESENT_CHOICES, names)


class TestChatRequestUserInput(unittest.TestCase):
    """Tests for chat_request_user_input handler."""

    def _get_handler(self):
        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        group = get_chat_function_group(task_tree_manager=ttm, file_system=fs)
        for name, defn in group.definitions:
            if name == CHAT_REQUEST_USER_INPUT:
                return defn.handler
        raise ValueError("chat_request_user_input not found")

    def test_raises_suspend_error(self):
        """Handler raises SuspendError with waitForInput event."""
        handler = self._get_handler()

        async def run():
            with self.assertRaises(SuspendError) as ctx:
                await handler(
                    {"user_message": "What is your name?"},
                    lambda s, **kw: None,
                )
            event = ctx.exception.event
            self.assertEqual(event.type, "waitForInput")
            self.assertTrue(len(event.request_id) > 0)
            self.assertEqual(event.input_type, "any")
            self.assertEqual(
                event.prompt["parts"][0]["text"],
                "What is your name?",
            )

        asyncio.run(run())

    def test_custom_input_type(self):
        handler = self._get_handler()

        async def run():
            with self.assertRaises(SuspendError) as ctx:
                await handler(
                    {"user_message": "Upload a file", "input_type": "file-upload"},
                    lambda s, **kw: None,
                )
            self.assertEqual(ctx.exception.event.input_type, "file-upload")

        asyncio.run(run())

    def test_invalid_input_type_defaults(self):
        handler = self._get_handler()

        async def run():
            with self.assertRaises(SuspendError) as ctx:
                await handler(
                    {"user_message": "test", "input_type": "invalid"},
                    lambda s, **kw: None,
                )
            self.assertEqual(ctx.exception.event.input_type, "any")

        asyncio.run(run())

    def test_skip_label_included(self):
        handler = self._get_handler()

        async def run():
            with self.assertRaises(SuspendError) as ctx:
                await handler(
                    {"user_message": "test", "skip_label": "Skip this"},
                    lambda s, **kw: None,
                )
            self.assertEqual(ctx.exception.event.skip_label, "Skip this")

        asyncio.run(run())

    def test_function_call_part_included(self):
        handler = self._get_handler()

        async def run():
            with self.assertRaises(SuspendError) as ctx:
                await handler(
                    {"user_message": "test"},
                    lambda s, **kw: None,
                )
            fc = ctx.exception.function_call_part
            self.assertEqual(
                fc["functionCall"]["name"],
                CHAT_REQUEST_USER_INPUT,
            )

        asyncio.run(run())


class TestChatPresentChoices(unittest.TestCase):
    """Tests for chat_present_choices handler."""

    def _get_handler(self):
        fs = AgentFileSystem()
        ttm = TaskTreeManager(fs)
        group = get_chat_function_group(task_tree_manager=ttm, file_system=fs)
        for name, defn in group.definitions:
            if name == CHAT_PRESENT_CHOICES:
                return defn.handler
        raise ValueError("chat_present_choices not found")

    def test_raises_suspend_error(self):
        handler = self._get_handler()

        async def run():
            with self.assertRaises(SuspendError) as ctx:
                await handler(
                    {
                        "user_message": "Pick a color",
                        "choices": [
                            {"id": "red", "label": "Red"},
                            {"id": "blue", "label": "Blue"},
                        ],
                        "selection_mode": "single",
                    },
                    lambda s, **kw: None,
                )
            event = ctx.exception.event
            self.assertEqual(event.type, "waitForChoice")
            self.assertTrue(len(event.request_id) > 0)
            self.assertEqual(event.selection_mode, "single")
            self.assertEqual(len(event.choices), 2)
            # Choices should be transformed to LLMContent format.
            self.assertEqual(
                event.choices[0].content["parts"][0]["text"],
                "Red",
            )

        asyncio.run(run())

    def test_none_of_the_above_label(self):
        handler = self._get_handler()

        async def run():
            with self.assertRaises(SuspendError) as ctx:
                await handler(
                    {
                        "user_message": "Pick",
                        "choices": [{"id": "a", "label": "A"}],
                        "selection_mode": "single",
                        "none_of_the_above_label": "Neither",
                    },
                    lambda s, **kw: None,
                )
            self.assertEqual(
                ctx.exception.event.none_of_the_above_label, "Neither"
            )

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()

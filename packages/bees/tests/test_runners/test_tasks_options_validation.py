# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import asyncio
import json
import tempfile
import shutil
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

from bees.task_store import TaskStore
from bees.functions.tasks import get_tasks_function_group_factory
from bees.subagent_scope import SubagentScope


class TestTasksOptionsValidation(unittest.TestCase):
    """Test dynamic options listing and validation in tasks function group."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.mkdtemp()
        self.hive_dir = Path(self.tmp_dir) / "hive"
        self.config_dir = self.hive_dir / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self.store = TaskStore(self.hive_dir)

        # Write a TEMPLATES.yaml with options_schema and enum
        templates = [
            {
                "name": "generate_images",
                "title": "Image Generator",
                "runner": "direct_model",
                "options_schema": {
                    "aspect_ratio": {
                        "type": "string",
                        "description": "Target aspect ratio.",
                        "enum": ["16:9", "1:1"]
                    }
                },
                "objective": "Image prompt"
            }
        ]
        import yaml
        with open(self.config_dir / "TEMPLATES.yaml", "w", encoding="utf-8") as f:
            yaml.dump(templates, f)

        self.parent_task = self.store.create("Parent objective", title="Parent Task", tasks=["generate_images"])
        self.scope = SubagentScope.for_ticket(self.parent_task)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp_dir)

    def _get_handler(self, func_name: str, group) -> Any:
        for name, defn in group.definitions:
            if name == func_name:
                return defn.handler
        raise ValueError(f"Handler {func_name} not found")

    def test_tasks_list_types_includes_options_schema(self):
        scheduler = MagicMock()
        scheduler.store = self.store

        factory = get_tasks_function_group_factory(
            scope=self.scope,
            caller_ticket_id=self.parent_task.id,
            scheduler=scheduler,
            ticket_id=self.parent_task.id,
        )
        group = factory(MagicMock())
        handler = self._get_handler("tasks_list_types", group)

        async def run_list():
            return await handler({}, MagicMock())

        result = asyncio.run(run_list())
        self.assertIn("task_types", result)
        
        types = result["task_types"]
        image_type = next((t for t in types if t["name"] == "generate_images"), None)
        self.assertIsNotNone(image_type)
        self.assertIn("options_schema", image_type)
        self.assertIn("aspect_ratio", image_type["options_schema"])
        self.assertEqual(image_type["options_schema"]["aspect_ratio"]["enum"], ["16:9", "1:1"])

    def test_tasks_create_task_valid_options(self):
        scheduler = MagicMock()
        scheduler.store = self.store

        factory = get_tasks_function_group_factory(
            scope=self.scope,
            caller_ticket_id=self.parent_task.id,
            scheduler=scheduler,
            ticket_id=self.parent_task.id,
        )
        group = factory(MagicMock())
        handler = self._get_handler("tasks_create_task", group)

        args = {
            "type": "generate_images",
            "summary": "Make a logo",
            "objective": "A bee logo",
            "slug": "logo",
            "options": {
                "aspect_ratio": "16:9"
            }
        }

        async def run_create():
            return await handler(args, MagicMock())

        result = asyncio.run(run_create())
        self.assertIn("task_id", result)

        # Verify options were successfully saved to TicketMetadata
        child_task = self.store.get(result["task_id"])
        self.assertIsNotNone(child_task)
        self.assertEqual(child_task.metadata.options, {"aspect_ratio": "16:9"})

    def test_tasks_create_task_invalid_option_key(self):
        scheduler = MagicMock()
        scheduler.store = self.store

        factory = get_tasks_function_group_factory(
            scope=self.scope,
            caller_ticket_id=self.parent_task.id,
            scheduler=scheduler,
            ticket_id=self.parent_task.id,
        )
        group = factory(MagicMock())
        handler = self._get_handler("tasks_create_task", group)

        args = {
            "type": "generate_images",
            "summary": "Make a logo",
            "objective": "A bee logo",
            "slug": "logo",
            "options": {
                "ratio": "16:9"  # Invalid/unknown key
            }
        }

        async def run_create():
            return await handler(args, MagicMock())

        result = asyncio.run(run_create())
        self.assertIn("error", result)
        self.assertIn("Invalid option(s): ratio", result["error"])
        self.assertIn("Supported options for 'generate_images' are: aspect_ratio", result["error"])

    def test_tasks_create_task_invalid_option_enum(self):
        scheduler = MagicMock()
        scheduler.store = self.store

        factory = get_tasks_function_group_factory(
            scope=self.scope,
            caller_ticket_id=self.parent_task.id,
            scheduler=scheduler,
            ticket_id=self.parent_task.id,
        )
        group = factory(MagicMock())
        handler = self._get_handler("tasks_create_task", group)

        args = {
            "type": "generate_images",
            "summary": "Make a logo",
            "objective": "A bee logo",
            "slug": "logo",
            "options": {
                "aspect_ratio": "17:1"  # Invalid enum value
            }
        }

        async def run_create():
            return await handler(args, MagicMock())

        result = asyncio.run(run_create())
        self.assertIn("error", result)
        self.assertIn("Invalid value '17:1' for option 'aspect_ratio'", result["error"])
        self.assertIn("Valid values for 'aspect_ratio' in 'generate_images' are: 16:9, 1:1", result["error"])


if __name__ == "__main__":
    unittest.main()

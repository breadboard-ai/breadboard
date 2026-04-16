# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for bees.box — change classification and watcher logic."""

from __future__ import annotations

import pytest
from pathlib import Path

from bees.box import classify_change


HIVE = Path("/tmp/test-hive")


class TestClassifyChange:
    """classify_change routes paths to the right category."""

    # -- Config paths (cold restart) --

    def test_system_yaml(self):
        assert classify_change(HIVE / "config" / "SYSTEM.yaml", HIVE) == "config"

    def test_templates_yaml(self):
        assert classify_change(HIVE / "config" / "TEMPLATES.yaml", HIVE) == "config"

    def test_hooks_module(self):
        assert classify_change(
            HIVE / "config" / "hooks" / "planner.py", HIVE
        ) == "config"

    def test_skill_file(self):
        assert classify_change(
            HIVE / "skills" / "listener" / "SKILL.md", HIVE
        ) == "config"

    def test_skills_dir_itself(self):
        assert classify_change(HIVE / "skills", HIVE) == "config"

    def test_config_dir_itself(self):
        assert classify_change(HIVE / "config", HIVE) == "config"

    # -- Task paths (hot trigger) --

    def test_ticket_metadata(self):
        assert classify_change(
            HIVE / "tickets" / "abc-123" / "metadata.json", HIVE
        ) == "task"

    def test_ticket_objective(self):
        assert classify_change(
            HIVE / "tickets" / "abc-123" / "objective.md", HIVE
        ) == "task"

    def test_ticket_response(self):
        assert classify_change(
            HIVE / "tickets" / "abc-123" / "response.json", HIVE
        ) == "task"

    def test_ticket_dir_created(self):
        assert classify_change(HIVE / "tickets" / "abc-123", HIVE) == "task"

    def test_tickets_dir_itself(self):
        assert classify_change(HIVE / "tickets", HIVE) == "task"

    # -- Ignored paths --

    def test_logs_ignored(self):
        assert classify_change(HIVE / "logs" / "session.log", HIVE) == "ignore"

    def test_hive_root_ignored(self):
        assert classify_change(HIVE, HIVE) == "ignore"

    def test_outside_hive_ignored(self):
        assert classify_change(Path("/other/place/file.txt"), HIVE) == "ignore"

    def test_dot_files_ignored(self):
        assert classify_change(HIVE / ".DS_Store", HIVE) == "ignore"

    # -- Mutation paths --

    def test_mutation_file(self):
        assert classify_change(
            HIVE / "mutations" / "abc-123.json", HIVE
        ) == "mutation"

    def test_mutation_result_ignored(self):
        assert classify_change(
            HIVE / "mutations" / "abc-123.result.json", HIVE
        ) == "ignore"

    def test_box_sentinel_ignored(self):
        assert classify_change(
            HIVE / "mutations" / ".box-active", HIVE
        ) == "ignore"

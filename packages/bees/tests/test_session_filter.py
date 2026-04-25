# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for merge_function_filter in bees.skill_filter."""

import pytest
from bees.skill_filter import merge_function_filter


class TestMergeFunctionFilter:
    """Covers the three cases for function filter merging."""

    def test_template_filter_plus_skill_tools(self):
        """Template functions + skill allowed-tools → union of both."""
        result = merge_function_filter(
            function_filter=["files.*", "tasks.*"],
            skill_tools=["sandbox.*", "events.*"],
            allowed_skills=["ui-generator"],
        )
        assert result == [
            "files.*", "tasks.*", "sandbox.*", "events.*", "skills.*",
        ]

    def test_no_template_filter_with_skill_tools(self):
        """No functions field + skill allowed-tools → skill tools only.

        This is the bug case: ui-generator template has no `functions`
        but its skill declares allowed-tools.
        """
        result = merge_function_filter(
            function_filter=None,
            skill_tools=["sandbox.*", "files.*", "events.*", "system.*"],
            allowed_skills=["ui-generator"],
        )
        assert result is not None, "Must not be None — would allow all functions"
        assert "skills.*" in result
        assert "sandbox.*" in result
        assert "files.*" in result

    def test_no_skills_no_filter_stays_none(self):
        """No skills, no filter → None (allow everything)."""
        result = merge_function_filter(
            function_filter=None,
            skill_tools=[],
            allowed_skills=None,
        )
        assert result is None

    def test_skills_without_allowed_tools(self):
        """Skills exist but declare no allowed-tools → filter unchanged."""
        result = merge_function_filter(
            function_filter=["tasks.*"],
            skill_tools=[],
            allowed_skills=["some-skill"],
        )
        assert result == ["tasks.*"]

    def test_does_not_mutate_input(self):
        """The caller's skill_tools list must not be mutated."""
        original_tools = ["sandbox.*"]
        merge_function_filter(
            function_filter=None,
            skill_tools=original_tools,
            allowed_skills=["x"],
        )
        assert original_tools == ["sandbox.*"], "Input list was mutated"

    def test_deduplication(self):
        """Overlapping globs between template and skills are deduplicated."""
        result = merge_function_filter(
            function_filter=["sandbox.*", "system.*"],
            skill_tools=["sandbox.*", "events.*"],
            allowed_skills=["x"],
        )
        assert result == ["sandbox.*", "system.*", "events.*", "skills.*"]

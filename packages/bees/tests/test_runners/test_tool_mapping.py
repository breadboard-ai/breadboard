# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for bees.runners.tool_mapping.

Covers all public and internal functions:

- ``wrap_bees_handler`` — schema propagation, handler bridging, ToolWithSchema
- ``_resolve_builtin_pattern`` — direct lookup, fnmatch, custom groups
- ``_extract_custom_tools`` — pre-built groups, factories, filtering, errors
- ``map_function_filter`` — None filter, builtin/custom/mixed filters,
  excluded builtins, subagents disabled
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from google.antigravity import types as ag_types
from google.antigravity.tools.tool_runner import ToolWithSchema

from bees.protocols.functions import (
    FunctionDefinition,
    FunctionGroup,
    SessionHooks,
)
from bees.runners.tool_mapping import (
    _CUSTOM_TOOL_GROUPS,
    _EXCLUDED_BUILTINS,
    _FILTER_TO_BUILTINS,
    _extract_custom_tools,
    _resolve_builtin_pattern,
    map_function_filter,
    wrap_bees_handler,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _StubHooks:
    """Minimal SessionHooks for tests."""

    @property
    def controller(self) -> Any:
        return None

    @property
    def file_system(self) -> Any:
        return None

    @property
    def task_tree_manager(self) -> Any:
        return None


async def _echo_handler(
    args: dict[str, Any], status_cb: Any,
) -> dict[str, Any]:
    """Returns the args it receives, for assertion."""
    return {"echo": args}


def _make_func_def(
    name: str = "test_fn",
    description: str = "A test function",
    schema: dict[str, Any] | None = None,
) -> FunctionDefinition:
    """Build a FunctionDefinition with an echo handler."""
    return FunctionDefinition(
        name=name,
        description=description,
        handler=_echo_handler,
        parameters_json_schema=schema,
    )


def _make_group(
    name: str,
    func_defs: list[FunctionDefinition] | None = None,
    instruction: str | None = None,
) -> FunctionGroup:
    """Build a FunctionGroup with definitions and optional instruction."""
    defs = func_defs or []
    return FunctionGroup(
        name=name,
        definitions=[(fd.name, fd) for fd in defs],
        declarations=[],
        instruction=instruction,
    )


# ---------------------------------------------------------------------------
# wrap_bees_handler
# ---------------------------------------------------------------------------


class TestWrapBeesHandler:
    """Tests for ``wrap_bees_handler``."""

    def test_returns_tool_with_schema(self) -> None:
        """Wrapped tool is a ToolWithSchema, not a bare callable."""
        func_def = _make_func_def(
            schema={"type": "object", "properties": {"x": {"type": "string"}}},
        )
        tool = wrap_bees_handler(func_def)
        assert isinstance(tool, ToolWithSchema)

    def test_schema_propagated(self) -> None:
        """The explicit JSON schema is attached to input_schema."""
        schema = {
            "type": "object",
            "properties": {"slug": {"type": "string"}},
            "required": ["slug"],
        }
        func_def = _make_func_def(schema=schema)
        tool = wrap_bees_handler(func_def)
        assert tool.input_schema == schema

    def test_no_schema_produces_empty_object(self) -> None:
        """A definition with no schema gets a minimal object schema."""
        func_def = _make_func_def(schema=None)
        tool = wrap_bees_handler(func_def)
        assert tool.input_schema == {"type": "object", "properties": {}}

    def test_name_and_doc_set(self) -> None:
        """__name__ and __doc__ are forwarded for SDK registration."""
        func_def = _make_func_def(name="my_tool", description="Does stuff")
        tool = wrap_bees_handler(func_def)
        assert tool.__name__ == "my_tool"
        assert tool.__doc__ == "Does stuff"

    def test_handler_bridging(self) -> None:
        """The wrapped tool calls the bees handler with (kwargs, cb)."""
        func_def = _make_func_def()
        tool = wrap_bees_handler(func_def)
        result = asyncio.run(
            tool(foo="bar", n=42),
        )
        assert result == {"echo": {"foo": "bar", "n": 42}}

    def test_handler_called_with_empty_args(self) -> None:
        """Zero-arg tools work — handler receives empty dict."""
        func_def = _make_func_def()
        tool = wrap_bees_handler(func_def)
        result = asyncio.run(tool())
        assert result == {"echo": {}}


# ---------------------------------------------------------------------------
# _resolve_builtin_pattern
# ---------------------------------------------------------------------------


class TestResolveBuiltinPattern:
    """Tests for ``_resolve_builtin_pattern``."""

    @pytest.mark.parametrize(
        "pattern",
        list(_FILTER_TO_BUILTINS.keys()),
    )
    def test_direct_table_lookup(self, pattern: str) -> None:
        """Every table key resolves to its corresponding builtins."""
        result = _resolve_builtin_pattern(pattern)
        assert result == _FILTER_TO_BUILTINS[pattern]

    def test_fnmatch_sub_pattern(self) -> None:
        """Sub-patterns like 'chat.await_context_update' match via fnmatch."""
        result = _resolve_builtin_pattern("chat.await_context_update")
        assert result == _FILTER_TO_BUILTINS["chat.*"]

    def test_files_sub_pattern(self) -> None:
        """Sub-patterns like 'files.read' match the files group."""
        result = _resolve_builtin_pattern("files.read")
        assert result == _FILTER_TO_BUILTINS["files.*"]

    def test_custom_group_returns_none(self) -> None:
        """Patterns for custom groups (agents, events, skills) return None."""
        assert _resolve_builtin_pattern("agents.*") is None
        assert _resolve_builtin_pattern("events.*") is None
        assert _resolve_builtin_pattern("skills.*") is None

    def test_unknown_pattern_returns_none(self) -> None:
        """Completely unknown patterns return None."""
        assert _resolve_builtin_pattern("unknown.*") is None
        assert _resolve_builtin_pattern("nope") is None


# ---------------------------------------------------------------------------
# _extract_custom_tools
# ---------------------------------------------------------------------------


class TestExtractCustomTools:
    """Tests for ``_extract_custom_tools``."""

    def test_extracts_from_prebuilt_group(self) -> None:
        """Pre-built FunctionGroup objects are consumed directly."""
        fd = _make_func_def(name="agents_list")
        group = _make_group("agents", [fd], instruction="Use agents.")
        tools, instructions = _extract_custom_tools(
            [group], _StubHooks(), include_groups=None,
        )
        assert len(tools) == 1
        assert tools[0].__name__ == "agents_list"
        assert instructions == ["Use agents."]

    def test_extracts_from_factory(self) -> None:
        """Callable factories are instantiated with hooks."""
        fd = _make_func_def(name="events_yield")

        def factory(hooks: SessionHooks) -> FunctionGroup:
            return _make_group("events", [fd], instruction="Event tools.")

        tools, instructions = _extract_custom_tools(
            [factory], _StubHooks(), include_groups=None,
        )
        assert len(tools) == 1
        assert tools[0].__name__ == "events_yield"
        assert instructions == ["Event tools."]

    def test_skips_builtin_groups(self) -> None:
        """Groups with names mapping to SDK builtins are skipped."""
        fd = _make_func_def(name="files_read")
        group = _make_group("files", [fd])
        tools, instructions = _extract_custom_tools(
            [group], _StubHooks(), include_groups=None,
        )
        assert tools == []

    def test_skips_system_group(self) -> None:
        """The 'system' group maps to SDK builtins and is skipped."""
        fd = _make_func_def(name="system_finish")
        group = _make_group("system", [fd])
        tools, instructions = _extract_custom_tools(
            [group], _StubHooks(), include_groups=None,
        )
        assert tools == []

    def test_include_groups_filters(self) -> None:
        """Only groups in include_groups are included."""
        agents_fd = _make_func_def(name="agents_list")
        events_fd = _make_func_def(name="events_yield")
        agents_group = _make_group("agents", [agents_fd], "Agents.")
        events_group = _make_group("events", [events_fd], "Events.")

        tools, instructions = _extract_custom_tools(
            [agents_group, events_group],
            _StubHooks(),
            include_groups={"agents"},
        )
        assert len(tools) == 1
        assert tools[0].__name__ == "agents_list"
        assert instructions == ["Agents."]

    def test_empty_instruction_not_collected(self) -> None:
        """Groups with no instruction don't add empty strings."""
        fd = _make_func_def(name="agents_list")
        group = _make_group("agents", [fd], instruction=None)
        _tools, instructions = _extract_custom_tools(
            [group], _StubHooks(), include_groups=None,
        )
        assert instructions == []

    def test_factory_error_is_skipped(self) -> None:
        """Failing factories are skipped with a warning, not a crash."""

        def bad_factory(hooks: SessionHooks) -> FunctionGroup:
            raise RuntimeError("Boom")

        tools, instructions = _extract_custom_tools(
            [bad_factory], _StubHooks(), include_groups=None,
        )
        assert tools == []
        assert instructions == []

    def test_non_callable_entries_skipped(self) -> None:
        """Entries that are neither FunctionGroup nor callable are skipped."""
        tools, instructions = _extract_custom_tools(
            ["not_a_group", 42],  # type: ignore[list-item]
            _StubHooks(),
            include_groups=None,
        )
        assert tools == []
        assert instructions == []

    def test_multiple_definitions_per_group(self) -> None:
        """All definitions from a single group are wrapped."""
        fd1 = _make_func_def(name="agents_list")
        fd2 = _make_func_def(name="agents_assign")
        group = _make_group("agents", [fd1, fd2])
        tools, _ = _extract_custom_tools(
            [group], _StubHooks(), include_groups=None,
        )
        names = [t.__name__ for t in tools]
        assert names == ["agents_list", "agents_assign"]


# ---------------------------------------------------------------------------
# map_function_filter
# ---------------------------------------------------------------------------


class TestMapFunctionFilter:
    """Tests for ``map_function_filter``."""

    def test_none_filter_enables_all_builtins(self) -> None:
        """None filter enables all SDK builtins except excluded ones."""
        caps, tools, instructions, _sq, _rq = map_function_filter(
            None, [], _StubHooks(),
        )
        enabled = set(caps.enabled_tools)
        # All builtins minus excluded.
        expected = set(ag_types.BuiltinTools) - _EXCLUDED_BUILTINS
        assert enabled == expected

    def test_none_filter_extracts_custom_groups(self) -> None:
        """None filter also extracts tools from custom groups."""
        fd = _make_func_def(name="agents_list")
        group = _make_group("agents", [fd], instruction="Agents.")

        _caps, tools, instructions, _sq, _rq = map_function_filter(
            None, [group], _StubHooks(),
        )
        assert len(tools) == 1
        assert tools[0].__name__ == "agents_list"
        assert instructions == ["Agents."]

    def test_builtin_filter_enables_correct_tools(self) -> None:
        """'files.*' enables exactly the file-related builtins."""
        caps, tools, instructions, _sq, _rq = map_function_filter(
            ["files.*"], [], _StubHooks(),
        )
        enabled = set(caps.enabled_tools)
        expected = set(_FILTER_TO_BUILTINS["files.*"])
        assert enabled == expected
        assert tools == []
        assert instructions == []

    def test_multiple_builtin_filters(self) -> None:
        """Multiple builtin filters union their tools."""
        caps, _, _, _sq, _rq = map_function_filter(
            ["files.*", "sandbox.*"], [], _StubHooks(),
        )
        enabled = set(caps.enabled_tools)
        expected = set(
            _FILTER_TO_BUILTINS["files.*"] + _FILTER_TO_BUILTINS["sandbox.*"],
        )
        assert enabled == expected

    def test_custom_filter_extracts_tools(self) -> None:
        """'agents.*' enables the agents custom tool group."""
        fd = _make_func_def(name="agents_list")
        group = _make_group("agents", [fd], instruction="Agents.")

        caps, tools, instructions, _sq, _rq = map_function_filter(
            ["agents.*"], [group], _StubHooks(),
        )
        # No builtins for agents.
        assert set(caps.enabled_tools) == set()
        assert len(tools) == 1
        assert tools[0].__name__ == "agents_list"
        assert instructions == ["Agents."]

    def test_mixed_filter(self) -> None:
        """Builtin + custom filters work together."""
        fd = _make_func_def(name="agents_list")
        group = _make_group("agents", [fd])

        caps, tools, _, _sq, _rq = map_function_filter(
            ["files.*", "system.*", "agents.*"], [group], _StubHooks(),
        )
        enabled = set(caps.enabled_tools)
        expected_builtins = set(
            _FILTER_TO_BUILTINS["files.*"] + _FILTER_TO_BUILTINS["system.*"],
        )
        assert enabled == expected_builtins
        assert len(tools) == 1

    def test_excluded_builtins_never_enabled(self) -> None:
        """GENERATE_IMAGE and START_SUBAGENT are never enabled."""
        caps, _, _, _sq, _rq = map_function_filter(None, [], _StubHooks())
        enabled = set(caps.enabled_tools)
        for excluded in _EXCLUDED_BUILTINS:
            assert excluded not in enabled

    def test_subagents_always_disabled(self) -> None:
        """enable_subagents is always False."""
        caps, _, _, _sq, _rq = map_function_filter(None, [], _StubHooks())
        assert caps.enable_subagents is False

        caps2, _, _, _sq, _rq = map_function_filter(
            ["files.*"], [], _StubHooks(),
        )
        assert caps2.enable_subagents is False

    def test_enabled_tools_sorted(self) -> None:
        """enabled_tools are sorted by enum value for deterministic output."""
        caps, _, _, _sq, _rq = map_function_filter(None, [], _StubHooks())
        values = [t.value for t in caps.enabled_tools]
        assert values == sorted(values)

    def test_individual_function_name_resolves_to_group(self) -> None:
        """'agents_assign_task' resolves to the 'agents' custom group."""
        fd = _make_func_def(name="agents_assign_task")
        group = _make_group("agents", [fd])

        _caps, tools, _, _sq, _rq = map_function_filter(
            ["agents_assign_task"], [group], _StubHooks(),
        )
        assert len(tools) == 1
        assert tools[0].__name__ == "agents_assign_task"

    def test_empty_filter_enables_nothing(self) -> None:
        """An empty filter list enables no builtins and no custom tools."""
        caps, tools, instructions, _sq, _rq = map_function_filter(
            [], [], _StubHooks(),
        )
        assert set(caps.enabled_tools) == set()
        assert tools == []
        assert instructions == []

    def test_unknown_filter_ignored(self) -> None:
        """Unknown filter patterns are silently ignored."""
        caps, tools, instructions, _sq, _rq = map_function_filter(
            ["unknown.*", "nope"], [], _StubHooks(),
        )
        assert set(caps.enabled_tools) == set()
        assert tools == []

    def test_custom_tools_are_tool_with_schema(self) -> None:
        """Custom tools produced by map_function_filter are ToolWithSchema."""
        schema = {
            "type": "object",
            "properties": {"slug": {"type": "string"}},
            "required": ["slug"],
        }
        fd = _make_func_def(name="agents_cancel", schema=schema)
        group = _make_group("agents", [fd])

        _caps, tools, _, _sq, _rq = map_function_filter(
            ["agents.*"], [group], _StubHooks(),
        )
        assert len(tools) == 1
        assert isinstance(tools[0], ToolWithSchema)
        assert tools[0].input_schema == schema

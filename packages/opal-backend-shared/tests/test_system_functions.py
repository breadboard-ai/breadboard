# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for the system termination functions (Phase 4.4b).
"""

from __future__ import annotations

import pytest

from opal_backend_shared.function_definition import map_definitions
from opal_backend_shared.functions.system import (
    FAILED_TO_FULFILL_FUNCTION,
    OBJECTIVE_FULFILLED_FUNCTION,
    get_system_function_group,
)
from opal_backend_shared.loop import AgentResult, LoopController


# =============================================================================
# get_system_function_group Tests
# =============================================================================


class TestGetSystemFunctionGroup:
    """Tests for the system function group factory."""

    def test_returns_function_group_with_instruction(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        assert group.instruction is not None
        assert len(group.instruction) > 100  # The meta-plan is ~200 lines
        assert "meta-plan" in group.instruction
        assert "Cynefin" in group.instruction

    def test_includes_both_function_declarations(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        names = [d["name"] for d in group.declarations]
        assert OBJECTIVE_FULFILLED_FUNCTION in names
        assert FAILED_TO_FULFILL_FUNCTION in names
        assert len(names) == 2

    def test_includes_both_function_definitions(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        def_names = [name for name, _ in group.definitions]
        assert OBJECTIVE_FULFILLED_FUNCTION in def_names
        assert FAILED_TO_FULFILL_FUNCTION in def_names

    def test_instruction_interpolates_function_names(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        assert OBJECTIVE_FULFILLED_FUNCTION in group.instruction
        assert FAILED_TO_FULFILL_FUNCTION in group.instruction

    def test_instruction_interpolates_date(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        # Should contain a date like "February 20, 2026"
        assert "202" in group.instruction  # Year prefix


# =============================================================================
# system_objective_fulfilled Tests
# =============================================================================


class TestObjectiveFulfilled:
    """Tests for the system_objective_fulfilled function."""

    @pytest.mark.asyncio
    async def test_terminates_controller_with_success(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        # Find the handler
        defn = dict(group.definitions)[OBJECTIVE_FULFILLED_FUNCTION]

        result = await defn.handler(
            {"objective_outcome": "All done!", "href": "/next"},
            lambda s: None,
        )

        assert result == {}
        assert controller.terminated is True
        agent_result = controller.result
        assert isinstance(agent_result, AgentResult)
        assert agent_result.success is True
        assert agent_result.href == "/next"
        assert agent_result.outcomes["parts"][0]["text"] == "All done!"

    @pytest.mark.asyncio
    async def test_defaults_href_to_root(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        defn = dict(group.definitions)[OBJECTIVE_FULFILLED_FUNCTION]
        await defn.handler({"objective_outcome": "Done"}, lambda s: None)

        agent_result = controller.result
        assert isinstance(agent_result, AgentResult)
        assert agent_result.href == "/"

    @pytest.mark.asyncio
    async def test_success_callback_called(self):
        controller = LoopController()
        callback_calls: list[tuple[str, str]] = []

        def on_success(href: str, text: str) -> None:
            callback_calls.append((href, text))

        group = get_system_function_group(
            controller, success_callback=on_success
        )
        defn = dict(group.definitions)[OBJECTIVE_FULFILLED_FUNCTION]
        await defn.handler(
            {"objective_outcome": "Result", "href": "/agent"},
            lambda s: None,
        )

        assert len(callback_calls) == 1
        assert callback_calls[0] == ("/agent", "Result")

    @pytest.mark.asyncio
    async def test_declarations_have_correct_schema(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        decl = next(
            d for d in group.declarations
            if d["name"] == OBJECTIVE_FULFILLED_FUNCTION
        )

        schema = decl["parametersJsonSchema"]
        assert "objective_outcome" in schema["properties"]
        assert "href" in schema["properties"]
        assert "objective_outcome" in schema["required"]


# =============================================================================
# system_failed_to_fulfill_objective Tests
# =============================================================================


class TestFailedToFulfill:
    """Tests for the system_failed_to_fulfill_objective function."""

    @pytest.mark.asyncio
    async def test_terminates_controller_with_failure(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        defn = dict(group.definitions)[FAILED_TO_FULFILL_FUNCTION]

        result = await defn.handler(
            {"user_message": "Can't do it"},
            lambda s: None,
        )

        assert result == {}
        assert controller.terminated is True
        agent_result = controller.result
        assert isinstance(agent_result, AgentResult)
        assert agent_result.success is False
        assert agent_result.outcomes["parts"][0]["text"] == "Can't do it"

    @pytest.mark.asyncio
    async def test_failure_callback_called(self):
        controller = LoopController()
        callback_messages: list[str] = []

        group = get_system_function_group(
            controller,
            failure_callback=lambda msg: callback_messages.append(msg),
        )
        defn = dict(group.definitions)[FAILED_TO_FULFILL_FUNCTION]
        await defn.handler(
            {"user_message": "Impossible"},
            lambda s: None,
        )

        assert callback_messages == ["Impossible"]

    @pytest.mark.asyncio
    async def test_declarations_have_correct_schema(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        decl = next(
            d for d in group.declarations
            if d["name"] == FAILED_TO_FULFILL_FUNCTION
        )

        schema = decl["parametersJsonSchema"]
        assert "user_message" in schema["properties"]
        assert "user_message" in schema["required"]

    @pytest.mark.asyncio
    async def test_empty_user_message_still_terminates(self):
        controller = LoopController()
        group = get_system_function_group(controller)

        defn = dict(group.definitions)[FAILED_TO_FULFILL_FUNCTION]
        await defn.handler({"user_message": ""}, lambda s: None)

        assert controller.terminated is True

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for the memory function group."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from opal_backend.agent_file_system import AgentFileSystem
from opal_backend.functions.memory import (
    get_memory_function_group,
    MEMORY_CREATE_SHEET_FUNCTION,
    MEMORY_READ_SHEET_FUNCTION,
    MEMORY_UPDATE_SHEET_FUNCTION,
    MEMORY_DELETE_SHEET_FUNCTION,
    MEMORY_GET_METADATA_FUNCTION,
)


# ---------------------------------------------------------------------------
# Helper: mock SheetManager
# ---------------------------------------------------------------------------


def _mock_sheet_manager(**overrides) -> AsyncMock:
    """Create a mock SheetManager with sensible defaults."""
    sm = AsyncMock()
    sm.create_sheet = AsyncMock(return_value={"success": True})
    sm.read_sheet = AsyncMock(
        return_value={"values": [["A", "B"], ["1", "2"]]}
    )
    sm.update_sheet = AsyncMock(return_value={"success": True})
    sm.delete_sheet = AsyncMock(return_value={"success": True})
    sm.get_sheet_metadata = AsyncMock(
        return_value={
            "sheets": [
                {
                    "name": "scores",
                    "file_path": "/mnt/memory/scores",
                    "columns": ["Name", "Score"],
                }
            ]
        }
    )
    for key, value in overrides.items():
        setattr(sm, key, value)
    return sm


def _noop_status(msg: str | None, opts: Any = None) -> None:
    pass


def _get_handler(group, name: str):
    """Extract a handler from a function group by name."""
    for fn_name, fn_def in group.definitions:
        if fn_name == name:
            return fn_def.handler
    raise KeyError(f"No function {name} in group")


# ---------------------------------------------------------------------------
# Function group structure
# ---------------------------------------------------------------------------


class TestFunctionGroupStructure:
    def test_group_has_all_functions(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(
            sheet_manager=sm, file_system=fs
        )
        names = {name for name, _ in group.definitions}
        assert names == {
            MEMORY_CREATE_SHEET_FUNCTION,
            MEMORY_READ_SHEET_FUNCTION,
            MEMORY_UPDATE_SHEET_FUNCTION,
            MEMORY_DELETE_SHEET_FUNCTION,
            MEMORY_GET_METADATA_FUNCTION,
        }

    def test_group_has_instruction(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(
            sheet_manager=sm, file_system=fs
        )
        assert group.instruction
        assert "memory_create_sheet" in group.instruction

    def test_declarations_match_definitions(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(
            sheet_manager=sm, file_system=fs
        )
        decl_names = {d["name"] for d in group.declarations}
        def_names = {name for name, _ in group.definitions}
        assert decl_names == def_names


# ---------------------------------------------------------------------------
# memory_create_sheet
# ---------------------------------------------------------------------------


class TestCreateSheet:
    @pytest.mark.asyncio
    async def test_success(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_CREATE_SHEET_FUNCTION)

        result = await handler(
            {"name": "scores", "columns": ["Name", "Score"]},
            _noop_status,
        )
        assert result["success"] is True
        sm.create_sheet.assert_called_once_with(
            name="scores", columns=["Name", "Score"]
        )

    @pytest.mark.asyncio
    async def test_error(self):
        sm = _mock_sheet_manager(
            create_sheet=AsyncMock(
                return_value={"success": False, "error": "Duplicate"}
            )
        )
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_CREATE_SHEET_FUNCTION)

        result = await handler(
            {"name": "scores", "columns": []},
            _noop_status,
        )
        assert "error" in result
        assert "Duplicate" in result["error"]


# ---------------------------------------------------------------------------
# memory_read_sheet
# ---------------------------------------------------------------------------


class TestReadSheet:
    @pytest.mark.asyncio
    async def test_json_output(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_READ_SHEET_FUNCTION)

        result = await handler(
            {"range": "Sheet1!A:B", "output_format": "json"},
            _noop_status,
        )
        assert "json" in result
        parsed = json.loads(result["json"])
        assert parsed["values"] == [["A", "B"], ["1", "2"]]

    @pytest.mark.asyncio
    async def test_file_output(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_READ_SHEET_FUNCTION)

        result = await handler(
            {"range": "Sheet1!A:B", "output_format": "file"},
            _noop_status,
        )
        assert "file_path" in result
        assert result["file_path"].startswith("/mnt/")

    @pytest.mark.asyncio
    async def test_empty_sheet(self):
        sm = _mock_sheet_manager(
            read_sheet=AsyncMock(return_value={"values": []})
        )
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_READ_SHEET_FUNCTION)

        result = await handler(
            {"range": "Sheet1!A:B", "output_format": "json"},
            _noop_status,
        )
        assert "error" in result
        assert "empty" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_error_propagation(self):
        sm = _mock_sheet_manager(
            read_sheet=AsyncMock(return_value={"error": "Sheet not found"})
        )
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_READ_SHEET_FUNCTION)

        result = await handler(
            {"range": "Missing!A:B", "output_format": "json"},
            _noop_status,
        )
        assert result["error"] == "Sheet not found"


# ---------------------------------------------------------------------------
# memory_update_sheet
# ---------------------------------------------------------------------------


class TestUpdateSheet:
    @pytest.mark.asyncio
    async def test_plain_values(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_UPDATE_SHEET_FUNCTION)

        result = await handler(
            {
                "range": "Sheet1!A1",
                "values": [["hello", "world"]],
            },
            _noop_status,
        )
        assert result["success"] is True
        sm.update_sheet.assert_called_once_with(
            range="Sheet1!A1", values=[["hello", "world"]]
        )

    @pytest.mark.asyncio
    async def test_with_file_reference(self):
        """Values containing <file src="/mnt/..." /> should be resolved."""
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        # Register a file the pidgin translator can resolve.
        fs.overwrite("test.md", "resolved content")
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_UPDATE_SHEET_FUNCTION)

        result = await handler(
            {
                "range": "Sheet1!A1",
                "values": [['<file src="/mnt/test.md" />']],
            },
            _noop_status,
        )
        assert result["success"] is True
        call_args = sm.update_sheet.call_args
        assert "resolved content" in call_args.kwargs["values"][0][0]


# ---------------------------------------------------------------------------
# memory_delete_sheet
# ---------------------------------------------------------------------------


class TestDeleteSheet:
    @pytest.mark.asyncio
    async def test_success(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_DELETE_SHEET_FUNCTION)

        result = await handler({"name": "scores"}, _noop_status)
        assert result["success"] is True
        sm.delete_sheet.assert_called_once_with(name="scores")


# ---------------------------------------------------------------------------
# memory_get_metadata
# ---------------------------------------------------------------------------


class TestGetMetadata:
    @pytest.mark.asyncio
    async def test_returns_sheets(self):
        sm = _mock_sheet_manager()
        fs = AgentFileSystem()
        group = get_memory_function_group(sheet_manager=sm, file_system=fs)
        handler = _get_handler(group, MEMORY_GET_METADATA_FUNCTION)

        result = await handler({}, _noop_status)
        assert len(result["sheets"]) == 1
        assert result["sheets"][0]["name"] == "scores"

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for SheetManager."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from opal_backend.sheet_manager import (
    SheetManager,
    parse_sheet_name,
    is_system_sheet,
    _make_file_key,
)


# ---------------------------------------------------------------------------
# Helper: mock DriveOperationsClient
# ---------------------------------------------------------------------------


def _mock_drive(**overrides) -> AsyncMock:
    """Create a mock DriveOperationsClient with sensible defaults."""
    drive = AsyncMock()
    drive.query_files = AsyncMock(return_value=[])
    drive.create_file = AsyncMock(return_value={"id": "new-spreadsheet-id"})
    drive.update_spreadsheet = AsyncMock()
    drive.set_spreadsheet_values = AsyncMock()
    drive.get_spreadsheet_values = AsyncMock(return_value=[])
    drive.append_spreadsheet_values = AsyncMock()
    drive.get_spreadsheet_metadata = AsyncMock(return_value={"sheets": []})
    for key, value in overrides.items():
        setattr(drive, key, value)
    return drive


# ---------------------------------------------------------------------------
# Unit helpers
# ---------------------------------------------------------------------------


class TestParseSheetName:
    def test_simple_name(self):
        assert parse_sheet_name("MySheet!A1:B3") == "MySheet"

    def test_quoted_name(self):
        assert parse_sheet_name("'My Sheet'!A1") == "My Sheet"

    def test_no_prefix(self):
        assert parse_sheet_name("A1:B3") is None

    def test_underscore_name(self):
        assert parse_sheet_name("data_store!C1") == "data_store"


class TestIsSystemSheet:
    def test_system_sheet(self):
        assert is_system_sheet("__chat_log__") is True

    def test_normal_sheet(self):
        assert is_system_sheet("memory") is False

    def test_single_underscore(self):
        assert is_system_sheet("_not_system") is False


class TestMakeFileKey:
    def test_key_format(self):
        assert _make_file_key("abc123") == "sheetabc123abc123"

    def test_empty_graph_id(self):
        assert _make_file_key("") == "sheet"


# ---------------------------------------------------------------------------
# SheetManager — spreadsheet ID resolution
# ---------------------------------------------------------------------------


class TestSpreadsheetResolution:
    @pytest.mark.asyncio
    async def test_find_existing_spreadsheet(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "existing-id"}])
        )
        manager = SheetManager(
            drive=drive, graph_url="drive:/abc123", graph_title="Test"
        )

        # Trigger resolution.
        result = await manager.read_sheet(range="Sheet1!A1")
        assert result == {"values": []}
        drive.query_files.assert_called_once()
        # Should NOT have called create_file.
        drive.create_file.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_new_spreadsheet(self):
        drive = _mock_drive()
        manager = SheetManager(
            drive=drive, graph_url="drive:/abc123", graph_title="Test Opal"
        )

        result = await manager.read_sheet(range="Sheet1!A1")
        assert result == {"values": []}
        drive.create_file.assert_called_once()
        # Verify the file key matches the TS pattern.
        call_args = drive.create_file.call_args[0][0]
        assert call_args["appProperties"]["google-drive-connector"] == "sheetabc123abc123"
        assert call_args["name"] == "Memory for Test Opal"

        # Rename to "intro" and write intro message.
        drive.update_spreadsheet.assert_called_once()
        drive.set_spreadsheet_values.assert_called()

    @pytest.mark.asyncio
    async def test_cached_spreadsheet_id(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "cached-id"}])
        )
        manager = SheetManager(
            drive=drive, graph_url="drive:/abc123", graph_title="Test"
        )

        # First call resolves.
        await manager.read_sheet(range="A1")
        # Second call should use cache.
        await manager.read_sheet(range="B1")
        # query_files should only have been called once.
        assert drive.query_files.call_count == 1


# ---------------------------------------------------------------------------
# SheetManager — sheet operations
# ---------------------------------------------------------------------------


class TestCreateSheet:
    @pytest.mark.asyncio
    async def test_create_sheet_success(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}])
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.create_sheet(
            name="scores", columns=["Name", "Score"]
        )
        assert result["success"] is True
        drive.update_spreadsheet.assert_called_once()
        drive.set_spreadsheet_values.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_sheet_error(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            update_spreadsheet=AsyncMock(side_effect=ValueError("API error")),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.create_sheet(name="bad", columns=[])
        assert result["success"] is False
        assert "API error" in result["error"]


class TestReadSheet:
    @pytest.mark.asyncio
    async def test_read_sheet_values(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            get_spreadsheet_values=AsyncMock(
                return_value=[["A1", "B1"], ["A2", "B2"]]
            ),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.read_sheet(range="Sheet1!A:B")
        assert result == {"values": [["A1", "B1"], ["A2", "B2"]]}


class TestUpdateSheet:
    @pytest.mark.asyncio
    async def test_update_sheet_success(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}])
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.update_sheet(
            range="Sheet1!A1", values=[["x", "y"]]
        )
        assert result["success"] is True
        drive.set_spreadsheet_values.assert_called_once_with(
            "sid", "Sheet1!A1", [["x", "y"]]
        )


class TestDeleteSheet:
    @pytest.mark.asyncio
    async def test_delete_sheet_success(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            get_spreadsheet_metadata=AsyncMock(
                return_value={
                    "sheets": [
                        {"properties": {"title": "scores", "sheetId": 42}},
                    ]
                }
            ),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.delete_sheet(name="scores")
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_delete_sheet_not_found(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            get_spreadsheet_metadata=AsyncMock(
                return_value={"sheets": []}
            ),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.delete_sheet(name="missing")
        assert result["success"] is False
        assert "not found" in result["error"]


class TestEnsureSystemSheet:
    @pytest.mark.asyncio
    async def test_existing_system_sheet(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            get_spreadsheet_metadata=AsyncMock(
                return_value={
                    "sheets": [
                        {
                            "properties": {
                                "title": "__chat_log__",
                                "sheetId": 1,
                            }
                        },
                    ]
                }
            ),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.ensure_system_sheet(
            name="__chat_log__", columns=["ts", "role", "content"]
        )
        assert result["success"] is True
        # Should NOT have called update_spreadsheet for addSheet.
        drive.update_spreadsheet.assert_not_called()

    @pytest.mark.asyncio
    async def test_new_system_sheet(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            get_spreadsheet_metadata=AsyncMock(
                return_value={"sheets": []}
            ),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.ensure_system_sheet(
            name="__chat_log__", columns=["ts", "role"]
        )
        assert result["success"] is True
        # Should have called addSheet.
        drive.update_spreadsheet.assert_called_once()


class TestGetSheetMetadata:
    @pytest.mark.asyncio
    async def test_excludes_intro_and_system_sheets(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            get_spreadsheet_metadata=AsyncMock(
                return_value={
                    "sheets": [
                        {"properties": {"title": "intro", "sheetId": 0}},
                        {"properties": {"title": "__chat_log__", "sheetId": 1}},
                        {"properties": {"title": "scores", "sheetId": 2}},
                    ]
                }
            ),
            get_spreadsheet_values=AsyncMock(
                return_value=[["Name", "Score"]]
            ),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.get_sheet_metadata()
        assert len(result["sheets"]) == 1
        assert result["sheets"][0]["name"] == "scores"
        assert result["sheets"][0]["columns"] == ["Name", "Score"]

    @pytest.mark.asyncio
    async def test_no_spreadsheet_returns_empty(self):
        drive = _mock_drive()  # query_files returns []
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.get_sheet_metadata()
        assert result == {"sheets": []}


class TestReadSheetAsText:
    @pytest.mark.asyncio
    async def test_returns_json(self):
        drive = _mock_drive(
            query_files=AsyncMock(return_value=[{"id": "sid"}]),
            get_spreadsheet_values=AsyncMock(
                return_value=[["a", "b"], ["c", "d"]]
            ),
        )
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.read_sheet_as_text("Sheet1")
        assert result == '[["a", "b"], ["c", "d"]]'

    @pytest.mark.asyncio
    async def test_no_spreadsheet_returns_none(self):
        drive = _mock_drive()  # query_files returns []
        manager = SheetManager(drive=drive, graph_url="drive:/g")

        result = await manager.read_sheet_as_text("Sheet1")
        assert result is None

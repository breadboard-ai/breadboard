# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for ChatLogManager and derive_chat_log."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from opal_backend.chat_log_manager import ChatLogManager, derive_chat_log


# =============================================================================
# derive_chat_log
# =============================================================================


class TestDeriveChatLog:
    """Tests for the pure derive_chat_log function."""

    def test_extracts_user_input(self):
        """Extracts model message and user response from chat_request_user_input."""
        contents = [
            {"parts": [{"text": "objective"}], "role": "user"},
            {"parts": [{"functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": "What is your name?"},
            }}], "role": "model"},
            {"parts": [{"functionResponse": {
                "name": "chat_request_user_input",
                "response": {"user_input": "Alice"},
            }}], "role": "user"},
        ]
        log = derive_chat_log(contents)
        assert len(log) == 2
        assert log[0] == {"role": "model", "parts": [{"text": "What is your name?"}]}
        assert log[1] == {"role": "user", "parts": [{"text": "Alice"}]}

    def test_extracts_choices(self):
        """Extracts model message and selected IDs from chat_present_choices."""
        contents = [
            {"parts": [{"functionCall": {
                "name": "chat_present_choices",
                "args": {"user_message": "Pick a color"},
            }}], "role": "model"},
            {"parts": [{"functionResponse": {
                "name": "chat_present_choices",
                "response": {"selected": {"ids": ["red", "blue"]}},
            }}], "role": "user"},
        ]
        log = derive_chat_log(contents)
        assert len(log) == 2
        assert log[0]["role"] == "model"
        assert log[1] == {"role": "user", "parts": [{"text": "red, blue"}]}

    def test_ignores_non_chat_functions(self):
        """Non-chat function calls are not included."""
        contents = [
            {"parts": [{"functionCall": {
                "name": "generate_text",
                "args": {"prompt": "hello"},
            }}], "role": "model"},
            {"parts": [{"functionResponse": {
                "name": "generate_text",
                "response": {"text": "world"},
            }}], "role": "user"},
        ]
        assert derive_chat_log(contents) == []

    def test_empty_contents(self):
        """Empty contents returns empty log."""
        assert derive_chat_log([]) == []

    def test_skips_empty_user_message(self):
        """Function calls with empty user_message are not included."""
        contents = [
            {"parts": [{"functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": ""},
            }}], "role": "model"},
        ]
        assert derive_chat_log(contents) == []

    def test_multiple_turns(self):
        """Multiple chat interactions produce ordered entries."""
        contents = [
            {"parts": [{"functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": "Q1"},
            }}], "role": "model"},
            {"parts": [{"functionResponse": {
                "name": "chat_request_user_input",
                "response": {"user_input": "A1"},
            }}], "role": "user"},
            {"parts": [{"functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": "Q2"},
            }}], "role": "model"},
            {"parts": [{"functionResponse": {
                "name": "chat_request_user_input",
                "response": {"user_input": "A2"},
            }}], "role": "user"},
        ]
        log = derive_chat_log(contents)
        assert len(log) == 4
        assert [e["parts"][0]["text"] for e in log] == ["Q1", "A1", "Q2", "A2"]


# =============================================================================
# ChatLogManager.seed
# =============================================================================


def _make_mock_sheet_manager(
    *,
    ensure_result=None,
    read_result=None,
):
    """Create a mock SheetManager for testing."""
    sm = MagicMock()
    sm.ensure_system_sheet = AsyncMock(
        return_value=ensure_result or {"success": True},
    )
    sm.read_sheet = AsyncMock(
        return_value=read_result or {},
    )
    sm.append_to_sheet = AsyncMock(return_value={"success": True})
    return sm


class TestSeed:
    """Tests for ChatLogManager.seed."""

    @pytest.mark.asyncio
    async def test_seed_creates_sheet_and_loads_rows(self):
        """Seed ensures sheet exists and loads historical entries."""
        sm = _make_mock_sheet_manager(
            read_result={
                "values": [
                    ["timestamp", "session_id", "role", "content"],
                    ["2026-01-01", "abc", "agent", "Hello"],
                    ["2026-01-01", "abc", "user", "Hi there"],
                ],
            },
        )
        mgr = ChatLogManager(sm)
        await mgr.seed()

        sm.ensure_system_sheet.assert_awaited_once()
        sm.read_sheet.assert_awaited_once()
        assert len(mgr.seeded_entries) == 2
        assert mgr.seeded_entries[0]["role"] == "model"
        assert mgr.seeded_entries[0]["parts"][0]["text"] == "Hello"
        assert mgr.seeded_entries[1]["role"] == "user"

    @pytest.mark.asyncio
    async def test_seed_no_sheet_manager(self):
        """No-op when no sheet manager provided."""
        mgr = ChatLogManager(None)
        await mgr.seed()
        assert mgr.seeded_entries == []

    @pytest.mark.asyncio
    async def test_seed_handles_ensure_failure(self):
        """Graceful when ensure_system_sheet fails."""
        sm = _make_mock_sheet_manager(
            ensure_result={"success": False, "error": "nope"},
        )
        mgr = ChatLogManager(sm)
        await mgr.seed()
        sm.read_sheet.assert_not_awaited()
        assert mgr.seeded_entries == []

    @pytest.mark.asyncio
    async def test_seed_skips_short_rows(self):
        """Rows with fewer than 4 columns are skipped."""
        sm = _make_mock_sheet_manager(
            read_result={
                "values": [
                    ["timestamp", "session_id", "role", "content"],
                    ["2026-01-01", "abc"],  # too short
                    ["2026-01-01", "abc", "agent", "Valid"],
                ],
            },
        )
        mgr = ChatLogManager(sm)
        await mgr.seed()
        assert len(mgr.seeded_entries) == 1

    @pytest.mark.asyncio
    async def test_seed_empty_sheet(self):
        """No values key in read result — empty seeded entries."""
        sm = _make_mock_sheet_manager(read_result={})
        mgr = ChatLogManager(sm)
        await mgr.seed()
        assert mgr.seeded_entries == []


# =============================================================================
# ChatLogManager.on_chat_entry
# =============================================================================


class TestOnChatEntry:
    """Tests for ChatLogManager.on_chat_entry."""

    @pytest.mark.asyncio
    async def test_appends_to_sheet(self):
        """Calling on_chat_entry appends a row to the sheet."""
        sm = _make_mock_sheet_manager()
        mgr = ChatLogManager(sm)
        mgr.on_chat_entry("agent", "Hello!")

        # Let the fire-and-forget future complete.
        import asyncio
        await asyncio.sleep(0)

        sm.append_to_sheet.assert_awaited_once()
        call_kwargs = sm.append_to_sheet.call_args[1]
        row = call_kwargs["values"][0]
        assert row[2] == "agent"
        assert row[3] == "Hello!"

    def test_noop_without_sheet_manager(self):
        """No error when no sheet manager."""
        mgr = ChatLogManager(None)
        mgr.on_chat_entry("agent", "Hello!")  # should not raise


# =============================================================================
# ChatLogManager.get_chat_log
# =============================================================================


class TestGetChatLog:
    """Tests for ChatLogManager.get_chat_log."""

    @pytest.mark.asyncio
    async def test_combines_seeded_and_derived(self):
        """get_chat_log returns seeded entries + derived from contents."""
        sm = _make_mock_sheet_manager(
            read_result={
                "values": [
                    ["timestamp", "session_id", "role", "content"],
                    ["2026-01-01", "abc", "agent", "Historical"],
                ],
            },
        )
        mgr = ChatLogManager(sm)
        await mgr.seed()

        contents = [
            {"parts": [{"functionCall": {
                "name": "chat_request_user_input",
                "args": {"user_message": "Current"},
            }}], "role": "model"},
        ]
        result = json.loads(mgr.get_chat_log(contents))
        assert len(result) == 2
        assert result[0]["parts"][0]["text"] == "Historical"
        assert result[1]["parts"][0]["text"] == "Current"

    def test_no_seeded_no_contents(self):
        """Empty when nothing to derive or seed."""
        mgr = ChatLogManager(None)
        assert json.loads(mgr.get_chat_log([])) == []


# =============================================================================
# ChatLogManager.persist_user_response
# =============================================================================


class TestPersistUserResponse:
    """Tests for ChatLogManager.persist_user_response."""

    @pytest.mark.asyncio
    async def test_persists_text_input(self):
        """chat_request_user_input response text is persisted."""
        sm = _make_mock_sheet_manager()
        mgr = ChatLogManager(sm)
        mgr.persist_user_response(
            "chat_request_user_input",
            {},
            {"input": {"role": "user", "parts": [{"text": "Hello"}]}},
        )

        import asyncio
        await asyncio.sleep(0)

        sm.append_to_sheet.assert_awaited_once()
        row = sm.append_to_sheet.call_args[1]["values"][0]
        assert row[2] == "user"
        assert row[3] == "Hello"

    @pytest.mark.asyncio
    async def test_persists_choice_labels(self):
        """chat_present_choices maps selected IDs to labels."""
        sm = _make_mock_sheet_manager()
        mgr = ChatLogManager(sm)
        mgr.persist_user_response(
            "chat_present_choices",
            {"choices": [
                {"id": "a", "label": "Apple"},
                {"id": "b", "label": "Banana"},
            ]},
            {"selected": {"ids": ["a", "b"]}},
        )

        import asyncio
        await asyncio.sleep(0)

        row = sm.append_to_sheet.call_args[1]["values"][0]
        assert row[3] == "Apple, Banana"

    def test_noop_for_non_chat_function(self):
        """Non-chat function names produce no sheet writes."""
        sm = _make_mock_sheet_manager()
        mgr = ChatLogManager(sm)
        mgr.persist_user_response(
            "generate_text", {}, {"text": "hello"},
        )
        sm.append_to_sheet.assert_not_called()

    def test_noop_without_sheet_manager(self):
        """No error when no sheet manager."""
        mgr = ChatLogManager(None)
        mgr.persist_user_response(
            "chat_request_user_input",
            {},
            {"input": {"role": "user", "parts": [{"text": "Hello"}]}},
        )



# =============================================================================
# ChatLogManager session_id
# =============================================================================


class TestSessionId:
    """Tests for ChatLogManager session_id handling."""

    def test_generates_default_session_id(self):
        """A UUID session_id is generated when none is provided."""
        mgr = ChatLogManager(None)
        assert len(mgr.session_id) > 0
        # Should look like a UUID.
        assert mgr.session_id.count("-") == 4

    def test_uses_provided_session_id(self):
        """An explicitly provided session_id is used instead of generating one."""
        mgr = ChatLogManager(None, session_id="custom-123")
        assert mgr.session_id == "custom-123"

    @pytest.mark.asyncio
    async def test_session_id_appears_in_sheet_row(self):
        """The session_id is included in appended chat log rows."""
        sm = _make_mock_sheet_manager()
        mgr = ChatLogManager(sm, session_id="test-session-42")
        mgr.on_chat_entry("agent", "Hello!")

        import asyncio
        await asyncio.sleep(0)

        row = sm.append_to_sheet.call_args[1]["values"][0]
        assert row[1] == "test-session-42"

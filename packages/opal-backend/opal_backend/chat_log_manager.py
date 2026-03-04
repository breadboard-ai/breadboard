# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""ChatLogManager — manages the in-memory chat log with optional sheet persistence.

Encapsulates three concerns:

1. **Derivation** — reconstructs the chat log from conversation ``contents``
   by scanning for ``chat_request_user_input`` / ``chat_present_choices``
   function call + response pairs.

2. **Seeding** — loads historical entries from the ``__chat_log__`` sheet
   (Google Sheets via ``SheetManager``) for cross-run memory.

3. **Persistence** — fire-and-forget appends to the ``__chat_log__`` sheet
   on each chat turn so entries survive across runs.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import uuid
from typing import Any

from .sheet_manager import SheetManager

export = ["ChatLogManager"]

logger = logging.getLogger(__name__)

_CHAT_FUNCTION_NAMES = {"chat_request_user_input", "chat_present_choices"}
_CHAT_LOG_SHEET = "__chat_log__"
_CHAT_LOG_RANGE = f"{_CHAT_LOG_SHEET}!A:D"
_CHAT_LOG_COLUMNS = ["timestamp", "session_id", "role", "content"]


def derive_chat_log(contents: list[dict[str, Any]]) -> list[dict]:
    """Reconstruct the chat log from conversation contents.

    Scans ``contents`` for ``chat_request_user_input`` and
    ``chat_present_choices`` function call + response pairs and returns
    them as ``{"role": "model"|"user", "parts": [...]}`` entries.

    This is a pure function — no mutable state needed.
    """
    entries: list[dict] = []
    for turn in contents:
        for part in turn.get("parts", []):
            # Model message: functionCall with a chat function name.
            fc = part.get("functionCall")
            if fc and fc.get("name") in _CHAT_FUNCTION_NAMES:
                msg = fc.get("args", {}).get("user_message", "")
                if msg:
                    entries.append(
                        {"role": "model", "parts": [{"text": msg}]}
                    )

            # User response: functionResponse for a chat function.
            fr = part.get("functionResponse")
            if fr and fr.get("name") in _CHAT_FUNCTION_NAMES:
                resp = fr.get("response", {})
                # chat_request_user_input → user_input text.
                user_text = resp.get("user_input")
                if user_text:
                    entries.append(
                        {"role": "user", "parts": [{"text": user_text}]}
                    )
                # chat_present_choices → selected IDs.
                selected = resp.get("selected")
                if selected:
                    entries.append(
                        {"role": "user", "parts": [{"text": ", ".join(selected)}]}
                    )
    return entries


class ChatLogManager:
    """Manages the in-memory chat log with optional sheet persistence.

    Usage::

        mgr = ChatLogManager(sheet_manager)
        await mgr.seed()
        file_system.add_system_file(CHAT_LOG_PATH, lambda: mgr.get_chat_log(contents))
        # On resume:
        mgr.persist_user_response(func_name, func_args, response)
    """

    def __init__(
        self,
        sheet_manager: SheetManager | None = None,
        session_id: str | None = None,
    ) -> None:
        self._sheet_manager = sheet_manager
        self._session_id = session_id or str(uuid.uuid4())
        self._seeded_entries: list[dict] = []

    @property
    def session_id(self) -> str:
        """The session identifier used for chat log entries."""
        return self._session_id

    @property
    def seeded_entries(self) -> list[dict]:
        """Historical entries loaded from the sheet."""
        return self._seeded_entries

    async def seed(self) -> None:
        """Ensure the ``__chat_log__`` sheet exists and load historical entries.

        No-op if no ``SheetManager`` was provided.
        """
        if not self._sheet_manager:
            return

        ensured = await self._sheet_manager.ensure_system_sheet(
            name=_CHAT_LOG_SHEET,
            columns=_CHAT_LOG_COLUMNS,
        )
        if not ensured.get("success"):
            return

        sheet_data = await self._sheet_manager.read_sheet(
            range=_CHAT_LOG_RANGE,
        )
        if "values" not in sheet_data:
            return

        # Skip header row (row 0 = column names).
        for row in sheet_data["values"][1:]:
            if len(row) < 4:
                continue
            role = "model" if row[2] == "agent" else "user"
            self._seeded_entries.append(
                {"role": role, "parts": [{"text": str(row[3])}]}
            )

    def on_chat_entry(self, role: str, content: str) -> None:
        """Fire-and-forget append to the ``__chat_log__`` sheet.

        No-op if no ``SheetManager`` was provided.
        Mirrors TS ``AgentUI.#appendChatLogEntry``.
        """

        if not self._sheet_manager:
            return
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        asyncio.ensure_future(
            self._sheet_manager.append_to_sheet(
                range=_CHAT_LOG_RANGE,
                values=[[timestamp, self._session_id, role, content]],
            )
        )

    def get_chat_log(self, contents: list[dict[str, Any]]) -> str:
        """Return the full chat log as a JSON string.

        Combines historical entries (seeded from the sheet) with
        current-session entries (derived from ``contents``).
        """
        return json.dumps(self._seeded_entries + derive_chat_log(contents))

    def persist_user_response(
        self,
        func_name: str,
        func_args: dict[str, Any],
        response: dict[str, Any],
    ) -> None:
        """Extract user text from a resume response and append to the sheet.

        Handles both ``chat_request_user_input`` (raw text) and
        ``chat_present_choices`` (selected IDs → joined labels).
        No-op for non-chat functions or when no sheet manager.
        """

        if not self._sheet_manager:
            return

        user_content: str | None = None
        if func_name == "chat_request_user_input":
            # Client sends {input: LLMContent} where LLMContent has parts.
            llm_content = response.get("input")
            if isinstance(llm_content, dict):
                parts = llm_content.get("parts", [])
                user_content = next(
                    (p.get("text", "") for p in parts if "text" in p), None
                )
        elif func_name == "chat_present_choices":
            selected_ids = response.get("selected", [])
            choices = func_args.get("choices", [])
            choice_map = {
                c.get("id", ""): c.get("label", "") for c in choices
            }
            labels = [choice_map.get(sid, sid) for sid in selected_ids]
            user_content = ", ".join(labels) if labels else None

        if user_content:
            self.on_chat_entry("user", user_content)

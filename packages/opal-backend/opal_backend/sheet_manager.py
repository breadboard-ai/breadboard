# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Memory sheet manager — persistent Google Sheets data store.

Port of ``sheet-manager.ts`` and ``memory-sheet-getter.ts``.

Manages per-graph memory spreadsheets via ``DriveOperationsClient``.
Each agent graph gets its own spreadsheet, identified by a
``google-drive-connector`` appProperty that encodes the graph ID.

TODO: Add per-graph read/metadata caching (TS uses a ``GraphCache``
scoped by ``NodeHandlerContext.currentGraph.url``). Currently every
operation hits the Sheets API directly.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote

from .drive_operations_client import DriveOperationsClient

__all__ = [
    "SheetManager",
    "parse_sheet_name",
    "is_system_sheet",
    "SYSTEM_SHEET_PREFIX",
]

logger = logging.getLogger(__name__)

SHEETS_MIME_TYPE = "application/vnd.google-apps.spreadsheet"
SYSTEM_SHEET_PREFIX = "__"

# Intro message written to the first sheet of a new memory spreadsheet.
_INTRO_MESSAGE = (
    "This spreadsheet is used as agent memory. "
    "Do not modify it directly. "
    "To reset the memory for the agent, move this entire spreadsheet "
    "into trash."
)


def parse_sheet_name(range_str: str) -> str | None:
    """Extract the sheet name from a range like ``SheetName!A1:B10``.

    Also handles quoted sheet names: ``'Sheet Name'!A1``.
    Returns ``None`` if no sheet name prefix (uses default sheet).

    Port of ``parseSheetName`` in ``sheet-manager.ts``.
    """
    match = re.match(r"^(?:'([^']+)'|([^!]+))!", range_str)
    if not match:
        return None
    return match.group(1) or match.group(2)


def is_system_sheet(name: str) -> bool:
    """Return True if the sheet name uses the system prefix convention.

    System sheets (e.g. ``__chat_log__``) are managed mechanically and
    hidden from the agent's normal memory functions.
    """
    return name.startswith(SYSTEM_SHEET_PREFIX)


def _make_file_key(graph_id: str) -> str:
    """Build the Drive appProperty value used to locate the memory sheet.

    Must produce the same key as the TS ``memorySheetGetter`` +
    ``getDriveCollectorFile`` combination:

        getTypeKey(SHEETS_MIME_TYPE) → "sheet"
        fileKey = `sheet${graphId}${graphId}`

    where ``graphId = url.replace("drive:/", "")``.
    """
    return f"sheet{graph_id}{graph_id}"


class SheetManager:
    """Manages memory sheets backed by Google Spreadsheets.

    Port of the TS ``SheetManager`` class. All operations delegate to a
    ``DriveOperationsClient`` for the actual API calls.

    Args:
        drive: The Drive/Sheets operations client.
        graph_url: The graph URL (format ``drive:/{fileId}``). Used to
            derive the graph ID for spreadsheet resolution.
        graph_title: Optional graph title, used when creating new
            spreadsheets.
    """

    def __init__(
        self,
        *,
        drive: DriveOperationsClient,
        graph_url: str = "",
        graph_title: str = "",
    ) -> None:
        self._drive = drive
        self._graph_id = graph_url.replace("drive:/", "") if graph_url else ""
        self._graph_title = graph_title
        self._spreadsheet_id: str | None = None

    # ------------------------------------------------------------------
    # Spreadsheet ID resolution (port of memorySheetGetter)
    # ------------------------------------------------------------------

    async def _find_spreadsheet(self) -> str | None:
        """Find an existing memory spreadsheet for this graph.

        Queries Drive for files matching the ``google-drive-connector``
        appProperty. Returns the file ID, or ``None`` if not found.
        """
        file_key = _make_file_key(self._graph_id)
        query = (
            f"appProperties has "
            f"{{ key = 'google-drive-connector' and value = '{file_key}' }} "
            f"and trashed = false"
        )
        files = await self._drive.query_files(query)
        if files:
            return files[0].get("id")
        return None

    async def _create_spreadsheet(self) -> str:
        """Create a new memory spreadsheet for this graph.

        Mirrors the TS ``memorySheetGetter`` creation flow:
        1. Create a spreadsheet with the ``google-drive-connector``
           appProperty.
        2. Rename the default sheet to ``intro``.
        3. Write the intro message.
        """
        file_key = _make_file_key(self._graph_id)
        name = f"Memory for {self._graph_title or self._graph_id}"

        result = await self._drive.create_file({
            "name": name,
            "mimeType": SHEETS_MIME_TYPE,
            "appProperties": {
                "google-drive-connector": file_key,
            },
        })
        spreadsheet_id = result["id"]

        # Rename the default "Sheet1" to "intro".
        await self._drive.update_spreadsheet(spreadsheet_id, [
            {
                "updateSheetProperties": {
                    "properties": {"sheetId": 0, "title": "intro"},
                    "fields": "title",
                },
            },
        ])

        # Write the intro message.
        await self._drive.set_spreadsheet_values(
            spreadsheet_id, "intro!A1", [[_INTRO_MESSAGE]]
        )

        return spreadsheet_id

    async def _ensure_spreadsheet_id(self) -> str:
        """Return the spreadsheet ID, creating one if necessary."""
        if self._spreadsheet_id:
            return self._spreadsheet_id

        found = await self._find_spreadsheet()
        if found:
            self._spreadsheet_id = found
            return found

        created = await self._create_spreadsheet()
        self._spreadsheet_id = created
        return created

    async def _check_spreadsheet_id(self) -> str | None:
        """Return the spreadsheet ID if it exists, without creating one."""
        if self._spreadsheet_id:
            return self._spreadsheet_id

        found = await self._find_spreadsheet()
        if found:
            self._spreadsheet_id = found
        return found

    # ------------------------------------------------------------------
    # Public sheet operations (port of SheetManager methods)
    # ------------------------------------------------------------------

    async def create_sheet(
        self, *, name: str, columns: list[str]
    ) -> dict[str, Any]:
        """Create a new memory sheet tab with column headers.

        Returns ``{"success": True}`` or ``{"success": False, "error": ...}``.
        """
        try:
            sid = await self._ensure_spreadsheet_id()
            await self._drive.update_spreadsheet(sid, [
                {"addSheet": {"properties": {"title": name}}},
            ])
            await self._drive.set_spreadsheet_values(
                sid, f"{name}!A1", [columns]
            )
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def read_sheet(self, *, range: str) -> dict[str, Any]:
        """Read values from a memory range.

        Returns ``{"values": [[...]]}`` or ``{"error": ...}``.
        """
        try:
            sid = await self._ensure_spreadsheet_id()
            values = await self._drive.get_spreadsheet_values(sid, range)
            return {"values": values}
        except Exception as e:
            return {"error": str(e)}

    async def update_sheet(
        self, *, range: str, values: list[list[str]]
    ) -> dict[str, Any]:
        """Overwrite a specific memory range with new data.

        Returns ``{"success": True}`` or ``{"success": False, "error": ...}``.
        """
        try:
            sid = await self._ensure_spreadsheet_id()
            await self._drive.set_spreadsheet_values(sid, range, values)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete_sheet(self, *, name: str) -> dict[str, Any]:
        """Delete a specific memory sheet tab.

        Returns ``{"success": True}`` or ``{"success": False, "error": ...}``.
        """
        try:
            sid = await self._ensure_spreadsheet_id()
            metadata = await self._drive.get_spreadsheet_metadata(sid)
            sheets = metadata.get("sheets", [])
            sheet = next(
                (
                    s
                    for s in sheets
                    if s.get("properties", {}).get("title") == name
                ),
                None,
            )
            if not sheet:
                return {"success": False, "error": f'Sheet "{name}" not found.'}

            sheet_id = sheet["properties"]["sheetId"]
            await self._drive.update_spreadsheet(sid, [
                {"deleteSheet": {"sheetId": sheet_id}},
            ])
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def append_to_sheet(
        self, *, range: str, values: list[list[str]]
    ) -> dict[str, Any]:
        """Append rows to the end of a range.

        Returns ``{"success": True}`` or ``{"success": False, "error": ...}``.
        """
        try:
            sid = await self._ensure_spreadsheet_id()
            await self._drive.append_spreadsheet_values(sid, range, values)
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def ensure_system_sheet(
        self, *, name: str, columns: list[str]
    ) -> dict[str, Any]:
        """Idempotent creation of a system sheet.

        If the sheet already exists, returns success without modifying it.
        """
        try:
            sid = await self._ensure_spreadsheet_id()
            metadata = await self._drive.get_spreadsheet_metadata(sid)
            sheets = metadata.get("sheets", [])
            exists = any(
                s.get("properties", {}).get("title") == name for s in sheets
            )
            if exists:
                return {"success": True}
            return await self.create_sheet(name=name, columns=columns)
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_sheet_metadata(
        self,
    ) -> dict[str, Any]:
        """List all non-system, non-intro sheets with their column headers.

        Returns ``{"sheets": [{"name": ..., "file_path": ..., "columns": [...]}]}``.
        """
        sid = await self._check_spreadsheet_id()
        if not sid:
            return {"sheets": []}

        try:
            metadata = await self._drive.get_spreadsheet_metadata(sid)
        except Exception as e:
            return {"error": str(e)}

        raw_sheets = metadata.get("sheets", [])
        result_sheets: list[dict[str, Any]] = []
        errors: list[str] = []

        for sheet in raw_sheets:
            props = sheet.get("properties", {})
            name = props.get("title", "")
            sheet_id = props.get("sheetId")

            # Skip the intro sheet (sheetId 0) and system sheets.
            if sheet_id == 0 or is_system_sheet(name):
                continue

            file_path = f"/mnt/memory/{quote(name, safe='')}"
            columns: list[str] = []

            try:
                values = await self._drive.get_spreadsheet_values(
                    sid, f"{quote(name, safe='')}!1:1"
                )
                if values and len(values) > 0:
                    columns = values[0]
            except Exception as e:
                errors.append(str(e))

            result_sheets.append({
                "name": name,
                "file_path": file_path,
                "columns": columns,
            })

        if errors:
            return {"error": ",".join(errors)}

        return {"sheets": result_sheets}

    async def read_sheet_as_text(self, sheet_name: str) -> str | None:
        """Read an entire sheet and return as JSON text.

        Used by ``AgentFileSystem`` to serve ``/mnt/memory/{name}`` paths.
        Returns ``None`` if no spreadsheet exists.
        """
        sid = await self._check_spreadsheet_id()
        if not sid:
            return None

        try:
            import json

            values = await self._drive.get_spreadsheet_values(
                sid, f"{sheet_name}!A:ZZ"
            )
            return json.dumps(values)
        except Exception:
            return None

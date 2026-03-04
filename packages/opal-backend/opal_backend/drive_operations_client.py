# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Protocol for Google Drive + Sheets operations.

Mirrors the TS ``api.ts`` + ``google-drive-host-operations.ts`` surface.
Synced code — no HTTP dependencies.
"""

from __future__ import annotations

from typing import Protocol


class DriveOperationsClient(Protocol):
    """Generic Google Drive + Sheets operations.

    Mirrors the TS api.ts + google-drive-host-operations.ts surface.
    Synced code — no HTTP dependencies.
    """

    # -- Drive file operations (from api.ts) --

    async def create_file(self, metadata: dict) -> dict:
        """Create a Drive file. Returns {id: str}."""
        ...

    async def get_file(self, file_id: str) -> dict:
        """Get file metadata."""
        ...

    async def delete_file(self, file_id: str) -> None:
        """Trash a file."""
        ...

    async def query_files(self, query: str) -> list[dict]:
        """Search Drive files by query string. Returns list of {id, name, ...}."""
        ...

    # -- Sheets operations (from api.ts) --

    async def get_spreadsheet_metadata(self, spreadsheet_id: str) -> dict:
        """Get spreadsheet metadata including sheet properties."""
        ...

    async def get_spreadsheet_values(
        self, spreadsheet_id: str, range: str
    ) -> list[list[str]]:
        """Read cell values from a range."""
        ...

    async def set_spreadsheet_values(
        self, spreadsheet_id: str, range: str, values: list[list[str]]
    ) -> None:
        """Write values to a range (overwrites)."""
        ...

    async def append_spreadsheet_values(
        self, spreadsheet_id: str, range: str, values: list[list[str]]
    ) -> None:
        """Append rows to the end of a range."""
        ...

    async def update_spreadsheet(
        self, spreadsheet_id: str, requests: list[dict]
    ) -> None:
        """Batch update (add/delete sheets, formatting, etc.)."""
        ...

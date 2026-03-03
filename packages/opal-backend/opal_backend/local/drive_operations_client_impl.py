# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""HTTP-based implementation of ``DriveOperationsClient``.

Makes authenticated calls to the Google Drive and Sheets REST APIs via
``httpx``. Used by the dev backend — this module is NOT synced to google3.

Port of the TS ``api.ts`` functions (``create``, ``get``, ``del``,
``getSpreadsheetMetadata``, ``getSpreadsheetValues``,
``setSpreadsheetValues``, ``appendSpreadsheetValues``,
``updateSpreadsheet``) and the ``GoogleDriveClient.listFiles`` query
helper.
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

import httpx

__all__ = ["HttpDriveOperationsClient"]

logger = logging.getLogger(__name__)

# Canonical Google API endpoints — must match packages/types canonical-endpoints.ts.
GOOGLE_DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files"
GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"


class HttpDriveOperationsClient:
    """HTTP implementation of ``DriveOperationsClient``.

    Mirrors the TS ``api()`` helper: JSON body, Bearer auth header,
    structured error extraction from ``{error: {message}}`` responses.
    """

    def __init__(
        self,
        *,
        httpx_client: httpx.AsyncClient,
        access_token: str,
    ) -> None:
        self._httpx = httpx_client
        self._access_token = access_token

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._access_token}",
        }

    # ------------------------------------------------------------------
    # Drive file operations (TS: create, get, del, listFiles)
    # ------------------------------------------------------------------

    async def create_file(self, metadata: dict) -> dict:
        """Create a Drive file. Returns ``{id: str}``.

        Port of TS ``create()`` → ``POST /drive/v3/files``.
        """
        return await self._api(GOOGLE_DRIVE_FILES_API, "POST", body=metadata)

    async def get_file(self, file_id: str) -> dict:
        """Get file metadata.

        Port of TS ``get()`` → ``GET /drive/v3/files/{id}``.
        """
        url = f"{GOOGLE_DRIVE_FILES_API}/{quote(file_id, safe='')}"
        return await self._api(url, "GET")

    async def delete_file(self, file_id: str) -> None:
        """Trash a file.

        Port of TS ``del()`` → ``DELETE /drive/v3/files/{id}``.
        """
        url = f"{GOOGLE_DRIVE_FILES_API}/{quote(file_id, safe='')}"
        await self._api(url, "DELETE")

    async def query_files(self, query: str) -> list[dict]:
        """Search Drive files by query string.

        Port of TS ``GoogleDriveClient.listFiles()`` →
        ``GET /drive/v3/files?q=...``.
        """
        url = f"{GOOGLE_DRIVE_FILES_API}?q={quote(query, safe='')}"
        result = await self._api(url, "GET")
        return result.get("files", [])

    # ------------------------------------------------------------------
    # Sheets operations (TS: getSpreadsheetMetadata, getSpreadsheetValues,
    #   setSpreadsheetValues, appendSpreadsheetValues, updateSpreadsheet)
    # ------------------------------------------------------------------

    async def get_spreadsheet_metadata(self, spreadsheet_id: str) -> dict:
        """Get spreadsheet metadata including sheet properties.

        Port of TS ``getSpreadsheetMetadata()`` →
        ``GET /v4/spreadsheets/{id}?fields=sheets.properties``.
        """
        url = (
            f"{GOOGLE_SHEETS_API}/{quote(spreadsheet_id, safe='')}"
            f"?fields=sheets.properties"
        )
        return await self._api(url, "GET")

    async def get_spreadsheet_values(
        self, spreadsheet_id: str, range: str
    ) -> list[list[str]]:
        """Read cell values from a range.

        Port of TS ``getSpreadsheetValues()`` →
        ``GET /v4/spreadsheets/{id}/values/{range}``.
        """
        url = (
            f"{GOOGLE_SHEETS_API}/{quote(spreadsheet_id, safe='')}"
            f"/values/{range}"
        )
        result = await self._api(url, "GET")
        return result.get("values", [])

    async def set_spreadsheet_values(
        self, spreadsheet_id: str, range: str, values: list[list[str]]
    ) -> None:
        """Write values to a range (overwrites).

        Port of TS ``setSpreadsheetValues()`` →
        ``PUT /v4/spreadsheets/{id}/values/{range}?valueInputOption=USER_ENTERED``.
        """
        url = (
            f"{GOOGLE_SHEETS_API}/{quote(spreadsheet_id, safe='')}"
            f"/values/{quote(range, safe='')}"
            f"?valueInputOption=USER_ENTERED"
        )
        await self._api(url, "PUT", body={"values": values})

    async def append_spreadsheet_values(
        self, spreadsheet_id: str, range: str, values: list[list[str]]
    ) -> None:
        """Append rows to the end of a range.

        Port of TS ``appendSpreadsheetValues()`` →
        ``POST /v4/spreadsheets/{id}/values/{range}:append?valueInputOption=USER_ENTERED``.
        """
        url = (
            f"{GOOGLE_SHEETS_API}/{quote(spreadsheet_id, safe='')}"
            f"/values/{quote(range, safe='')}:append"
            f"?valueInputOption=USER_ENTERED"
        )
        await self._api(url, "POST", body={"values": values})

    async def update_spreadsheet(
        self, spreadsheet_id: str, requests: list[dict]
    ) -> None:
        """Batch update (add/delete sheets, formatting, etc.).

        Port of TS ``updateSpreadsheet()`` →
        ``POST /v4/spreadsheets/{id}:batchUpdate``.
        """
        url = (
            f"{GOOGLE_SHEETS_API}/{quote(spreadsheet_id, safe='')}"
            f":batchUpdate"
        )
        await self._api(url, "POST", body={"requests": requests})

    # ------------------------------------------------------------------
    # Internal helper — mirrors the TS ``api()`` function
    # ------------------------------------------------------------------

    async def _api(
        self, url: str, method: str, *, body: Any | None = None
    ) -> Any:
        """Make an authenticated JSON API call.

        Mirrors the TS ``api()`` helper in ``api.ts``:
        - JSON body serialization
        - Bearer token auth
        - Error extraction from ``{error: {code, message, status}}``
        """
        response = await self._httpx.request(
            method, url, json=body, headers=self._headers()
        )

        # DELETE may return 204 No Content.
        if response.status_code == 204:
            return {}

        data = response.json()

        if isinstance(data, dict) and "error" in data:
            error_msg = data["error"].get("message", response.reason_phrase)
            logger.error("Drive API error: %s", data["error"])
            raise ValueError(f"Drive API error: {error_msg}")

        return data

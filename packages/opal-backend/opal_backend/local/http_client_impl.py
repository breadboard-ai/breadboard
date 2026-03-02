# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
httpx-based implementation of the HttpClient protocol.

This module is NOT synced to google3 — it lives in ``local/``.
The production backend provides its own implementation using internal
RPC infrastructure.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import httpx

from ..http_client import HttpClient, StreamResponse


DEFAULT_TIMEOUT = 120.0




class HttpxStreamResponse(StreamResponse):
    """Wraps an httpx streaming response for line-by-line iteration."""

    def __init__(self, response: httpx.Response) -> None:
        self._response = response
        self.status_code = response.status_code

    async def aread(self) -> bytes:
        return await self._response.aread()

    async def aiter_lines(self) -> AsyncIterator[str]:
        async for line in self._response.aiter_lines():
            yield line


class HttpxClient:
    """httpx-based implementation of HttpClient for local dev.

    Usage:
        async with client.stream_post(url, json=body, headers=headers) as stream:
            async for line in stream.aiter_lines():
                ...
    """

    def __init__(
        self,
        timeout: float = DEFAULT_TIMEOUT,
        access_token: str = "",
    ) -> None:
        self._client = httpx.AsyncClient(timeout=timeout)
        self._access_token = access_token

    @property
    def access_token(self) -> str:
        return self._access_token

    @property
    def httpx_client(self) -> httpx.AsyncClient:
        """Expose the underlying httpx client for direct use."""
        return self._client

    @asynccontextmanager
    async def stream_post(
        self,
        url: str,
        *,
        json: Any,
        headers: dict[str, str],
    ) -> AsyncIterator[HttpxStreamResponse]:
        async with self._client.stream(
            "POST", url, json=json, headers=headers
        ) as response:
            yield HttpxStreamResponse(response)

    async def close(self) -> None:
        """Close the underlying httpx client."""
        await self._client.aclose()

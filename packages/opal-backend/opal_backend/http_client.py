# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
HTTP client protocol for the agent loop.

Defines abstract types that the synced code uses for HTTP calls. The actual
implementation (httpx in dev, internal RPC in google3) is injected at
runtime.

This module has NO external dependencies — it uses only Python stdlib +
typing.
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Protocol, runtime_checkable


class HttpResponse:
    """Minimal HTTP response — no framework dependency.

    Implementations wrap their native response type to expose this interface.
    """

    status_code: int
    text: str
    reason_phrase: str

    def json(self) -> Any:
        """Parse the response body as JSON."""
        ...

    def raise_for_status(self) -> None:
        """Raise an exception if the response status is >= 400."""
        ...


class StreamResponse:
    """Async line iterator for streaming HTTP responses.

    Used by ``gemini_client.py`` to consume SSE streams from the Gemini API.
    """

    status_code: int

    async def aread(self) -> bytes:
        """Read the full response body (for error messages)."""
        ...

    async def aiter_lines(self) -> AsyncIterator[str]:
        """Iterate over response lines asynchronously."""
        ...  # type: ignore[return]


@runtime_checkable
class HttpClient(Protocol):
    """Transport abstraction for HTTP calls.

    The synced code uses this protocol. Implementations live outside
    the synced boundary:
    - ``local/http_client_impl.py`` — httpx-based (dev/test)
    - google3 production — internal RPC-based
    """

    async def post(
        self,
        url: str,
        *,
        json: Any,
        headers: dict[str, str],
    ) -> HttpResponse:
        """Send a POST request and return the full response."""
        ...

    async def stream_post(
        self,
        url: str,
        *,
        json: Any,
        headers: dict[str, str],
    ) -> StreamResponse:
        """Send a POST request and return a streaming response.

        The caller must consume the stream. The response object is valid
        only within the caller's async context.
        """
        ...

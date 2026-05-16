# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

from typing import Any, Callable, Protocol

from bees.protocols.session import SessionConfiguration
from opal_backend.local.backend_client_impl import HttpBackendClient


class GenAdapter(Protocol):
    """Protocol for direct generation adapters."""

    async def generate(
        self,
        config: SessionConfiguration,
        slug: str | None,
        log_event: Callable[[dict[str, Any]], Any],
        backend: HttpBackendClient,
        api_key: str,
        options: dict[str, Any] | None = None,
    ) -> None:
        ...

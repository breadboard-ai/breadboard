# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
ticket:drain CLI — run tickets in dependency-aware cycles.

Usage::

    npm run ticket:drain -w packages/bees
"""

from __future__ import annotations

import asyncio
import json

import httpx

from bees.scheduler import Scheduler, SchedulerHooks
from opal_backend.local.backend_client_impl import HttpBackendClient

from app.auth import load_gemini_key


async def drain() -> list[dict]:
    """Run tickets in dependency-aware cycles (batch mode)."""
    gemini_key = load_gemini_key()

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as http:
        backend = HttpBackendClient(
            upstream_base="",
            httpx_client=http,
            access_token="",
            gemini_key=gemini_key,
        )

        scheduler = Scheduler(http=http, backend=backend)
        return await scheduler.run_all_waves()


def main() -> None:
    """CLI entry point for ticket:drain."""
    summaries = asyncio.run(drain())
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    main()

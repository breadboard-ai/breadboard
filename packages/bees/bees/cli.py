# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Bees CLI — start an agent session and stream events to a file.

Usage::

    npm run session:start -w packages/bees -- "Your prompt text here"

Reads GEMINI_KEY from ``packages/bees/.env``.

Output format matches the eval viewer (``EvalFileData``): a JSON array
with ``context`` and ``outcome`` entries, loadable directly by
``packages/visual-editor/eval/viewer``.
"""

from __future__ import annotations

import asyncio
import json
import sys

import httpx

from bees.session import load_gemini_key, run_session
from opal_backend.local.backend_client_impl import HttpBackendClient


async def _run(text: str) -> dict:
    gemini_key = load_gemini_key()

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as http:
        backend = HttpBackendClient(
            upstream_base="",
            httpx_client=http,
            access_token="",
            gemini_key=gemini_key,
        )

        result = await run_session(text, http=http, backend=backend)

    return {
        "session_id": result.session_id,
        "status": result.status,
        "events": result.events,
        "output": result.output,
    }


def main() -> None:
    """CLI entry point."""
    args = sys.argv[1:]
    if not args:
        print(
            'Usage: npm run session:start -w packages/bees -- "prompt text"',
            file=sys.stderr,
        )
        sys.exit(1)

    text = " ".join(args)
    print(f"Starting session with: {text!r}", file=sys.stderr)

    result = asyncio.run(_run(text))

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

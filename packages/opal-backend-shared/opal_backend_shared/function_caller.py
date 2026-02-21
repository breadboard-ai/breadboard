# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Function caller — dispatches function calls from Gemini responses.

Port of ``function-caller.ts``. Collects async function call tasks,
awaits them all in parallel, and returns a combined ``LLMContent``
with all function responses.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from typing import Any

from .function_definition import FunctionDefinition

logger = logging.getLogger(__name__)

# Types matching the Gemini API parts format.
LLMContent = dict[str, Any]
FunctionCallPart = dict[str, Any]  # {"functionCall": {"name": ..., "args": ...}}
FunctionResponsePart = dict[str, Any]  # {"functionResponse": {"name": ..., "response": ...}}


@dataclass
class FunctionCallResult:
    """Result of a single function call."""

    call_id: str
    response: FunctionResponsePart


class FunctionCaller:
    """Collects and dispatches function calls from a single Gemini turn.

    Usage:
        caller = FunctionCaller(definition_map)
        caller.call(call_id, part, status_cb)
        caller.call(call_id, part, status_cb)
        results = await caller.get_results()
    """

    def __init__(
        self,
        built_in: dict[str, FunctionDefinition],
    ) -> None:
        self._built_in = built_in
        self._tasks: list[asyncio.Task[FunctionCallResult | None]] = []

    def call(
        self,
        call_id: str,
        part: FunctionCallPart,
        status_callback: Any = None,
        reporter: Any = None,
    ) -> None:
        """Queue a function call for execution.

        The actual call runs as an asyncio task so function calls within
        a single turn execute concurrently (matching TypeScript Promise.all).
        """
        task = asyncio.create_task(
            self._execute(call_id, part, status_callback, reporter)
        )
        self._tasks.append(task)

    async def _execute(
        self,
        call_id: str,
        part: FunctionCallPart,
        status_callback: Any,
        reporter: Any,
    ) -> FunctionCallResult | None:
        """Execute a single function call."""
        fc = part.get("functionCall", {})
        name = fc.get("name", "")
        args = fc.get("args", {})

        definition = self._built_in.get(name)
        if not definition:
            logger.error("Unknown function: %s", name)
            return FunctionCallResult(
                call_id=call_id,
                response={
                    "functionResponse": {
                        "name": name,
                        "response": {"error": f"Unknown function: {name}"},
                    }
                },
            )

        logger.info("Calling function: %s", name)

        def noop_status(_status: str | None, **_kwargs: Any) -> None:
            pass

        cb = status_callback or noop_status

        try:
            response = await definition.handler(args, cb)
            return FunctionCallResult(
                call_id=call_id,
                response={
                    "functionResponse": {
                        "name": name,
                        "response": response,
                    }
                },
            )
        except Exception as e:
            logger.exception("Function %s failed", name)
            return FunctionCallResult(
                call_id=call_id,
                response={
                    "functionResponse": {
                        "name": name,
                        "response": {"error": str(e)},
                    }
                },
            )

    async def get_results(
        self,
    ) -> dict[str, Any] | None:
        """Await all queued function calls and return combined results.

        Returns:
            None if no function calls were queued.
            A dict with ``combined`` (LLMContent) and ``results`` (list)
            if function calls were present.
        """
        if not self._tasks:
            return None

        raw_results = await asyncio.gather(*self._tasks)
        results = [r for r in raw_results if r is not None]

        combined: LLMContent = {
            "parts": [r.response for r in results],
            "role": "user",
        }

        return {
            "combined": combined,
            "results": results,
        }

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Function-call dispatch for the agent loop.

Port of ``function-caller.ts``.

Status: Behind flag (enableOpalBackend). The TypeScript implementation is
the production code path. Changes to the TS source may need to be ported here.

Collects async function call tasks,
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
from .suspend import SuspendError

logger = logging.getLogger(__name__)

# Types matching the Gemini API parts format.
LLMContent = dict[str, Any]
FunctionCallPart = dict[str, Any]  # {"functionCall": {"name": ..., "args": ...}}
FunctionResponsePart = dict[str, Any]  # {"functionResponse": {"name": ..., "response": ...}}

# Key that handlers use to signal extra text parts alongside their response.
# When a handler returns a dict containing this key, FunctionCaller extracts
# the value (a list of part dicts) and includes them as sibling parts in the
# combined user turn — separate from the functionResponse payload.
CONTEXT_PARTS_KEY = "__context_parts__"


@dataclass
class FunctionCallResult:
    """Result of a single function call."""

    call_id: str
    response: FunctionResponsePart
    # Optional extra text parts (e.g. context updates) to include in the
    # combined user turn alongside this function's response.
    context_parts: list[dict[str, Any]] | None = None


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
        self._tasks: list[asyncio.Task[FunctionCallResult | dict[str, Any] | None]] = []

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
    ) -> FunctionCallResult | dict[str, Any] | None:
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

        def noop_status(_status: str | None, _opts: Any = None) -> None:
            pass

        cb = status_callback or noop_status

        try:
            # Run precondition gate (e.g. consent check) before handler.
            if definition.precondition:
                await definition.precondition(args)
            response = await definition.handler(args, cb)
            # If the handler returned a $error outcome (fatal error),
            # propagate it directly — don't wrap in functionResponse.
            # Port of FunctionCallerImpl.#callBuiltIn check from TS.
            if isinstance(response, dict) and "$error" in response:
                return response
            # Extract context parts before building the functionResponse.
            context_parts = None
            if isinstance(response, dict):
                context_parts = response.pop(CONTEXT_PARTS_KEY, None)
            return FunctionCallResult(
                call_id=call_id,
                response={
                    "functionResponse": {
                        "name": name,
                        "response": response,
                    }
                },
                context_parts=context_parts,
            )
        except SuspendError:
            # Let SuspendError propagate — the loop catches it to save state.
            raise
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

        All tasks run to completion — even when one raises
        ``SuspendError``.  Completed sibling results are attached to the
        error so the loop can include them in the saved state.

        Returns:
            None if no function calls were queued.
            A dict with ``combined`` (LLMContent) and ``results`` (list)
            if function calls were present, or a ``{"$error": ...}`` dict
            if any function returned a fatal error.

        Raises:
            SuspendError: When one of the tasks needs client input.
                ``error.completed_responses`` contains results from
                sibling tasks that finished successfully.
        """
        if not self._tasks:
            return None

        raw_results = await asyncio.gather(
            *self._tasks, return_exceptions=True,
        )

        # Check for fatal ($error) outcomes — port of getResults() from TS.
        # Use the first fatal error only. Comma-joining multiple errors
        # corrupts structured JSON strings (e.g. RESOURCE_EXHAUSTED
        # payloads), making them unparseable by downstream consumers.
        for r in raw_results:
            if isinstance(r, dict) and "$error" in r:
                return r

        # Sort results into completed and suspended.
        suspend: SuspendError | None = None
        completed: list[FunctionCallResult] = []

        for r in raw_results:
            if isinstance(r, SuspendError):
                if suspend is None:
                    suspend = r
                else:
                    # Multiple suspends in one turn — only the first is
                    # honoured.  Inject an error response for extras so
                    # the model sees a result for every function call.
                    extra_name = (
                        r.function_call_part
                        .get("functionCall", {})
                        .get("name", "unknown")
                    )
                    completed.append(FunctionCallResult(
                        call_id="",
                        response={
                            "functionResponse": {
                                "name": extra_name,
                                "response": {
                                    "error": (
                                        "Another function in this turn "
                                        "suspended the session"
                                    ),
                                },
                            }
                        },
                    ))
            elif isinstance(r, FunctionCallResult):
                completed.append(r)
            elif isinstance(r, BaseException):
                # Shouldn't happen (_execute catches everything except
                # SuspendError), but handle defensively.
                logger.exception(
                    "Unexpected error in function task: %s", r,
                )

        if suspend is not None:
            suspend.completed_responses = completed
            raise suspend

        # Build combined user turn: function responses + any context parts.
        parts: list[dict[str, Any]] = [r.response for r in completed]
        for r in completed:
            if r.context_parts:
                parts.extend(r.context_parts)
        combined: LLMContent = {
            "parts": parts,
            "role": "user",
        }

        return {
            "combined": combined,
            "results": completed,
        }


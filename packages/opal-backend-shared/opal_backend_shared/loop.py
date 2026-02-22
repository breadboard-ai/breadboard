# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
The main agent loop — a pure Gemini function-calling orchestrator.

Port of ``loop.ts``. It does not create or own any external dependencies
(file systems, translators, progress managers). Instead, callers provide:

- **function_groups**: the tools the agent can call
- **hooks**: optional lifecycle callbacks for progress, state tracking, etc.

This makes the Loop reusable across different agent types:
- Content generation agent (full hooks for progress + run state)
- Graph editing agent (minimal or no hooks)
- Headless eval agent (run-state hooks only)
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

from .function_caller import FunctionCaller
from .function_definition import FunctionGroup
from .gemini_client import (
    GeminiBody,
    GeminiChunk,
    stream_generate_content,
)

logger = logging.getLogger(__name__)

# Types
LLMContent = dict[str, Any]
Outcome = dict[str, Any]  # Either a result dict or {"$error": "message"}

AGENT_MODEL = "gemini-3-flash-preview"


def err(message: str) -> Outcome:
    """Create an error outcome."""
    return {"$error": message}


def ok(value: Any) -> bool:
    """Check if a value is not an error outcome."""
    if isinstance(value, dict) and "$error" in value:
        return False
    return True


@dataclass
class FileData:
    """A file from the agent file system, keyed by path."""

    path: str
    content: LLMContent


@dataclass
class AgentResult:
    """Result of an agent loop run."""

    success: bool
    href: str = "/"
    outcomes: LLMContent | None = None
    intermediate: list[FileData] | None = None


@dataclass
class AgentRunArgs:
    """Arguments for a single agent loop run."""

    objective: LLMContent
    function_groups: list[FunctionGroup]
    hooks: LoopHooks | None = None
    contents: list[LLMContent] | None = None


@dataclass
class LoopHooks:
    """Optional lifecycle hooks the Loop invokes at key points.

    Each agent type opts in to whichever hooks it needs.
    All hooks are optional.
    """

    on_start: Callable[[LLMContent], None] | None = None
    on_finish: Callable[[], None] | None = None
    on_content: Callable[[LLMContent], None] | None = None
    on_thought: Callable[[str], None] | None = None
    on_function_call: (
        Callable[
            [dict[str, Any], str | None, str | None],
            dict[str, Any],
        ]
        | None
    ) = None
    on_function_call_update: (
        Callable[[str, str | None], None] | None
    ) = None
    on_function_result: (
        Callable[[str, LLMContent], None] | None
    ) = None
    on_turn_complete: Callable[[], None] | None = None
    on_send_request: Callable[[str, GeminiBody], None] | None = None


class LoopController:
    """Controls the Loop's termination from outside.

    Function groups (e.g. system_objective_fulfilled) call
    ``terminate(result)`` to stop the loop and set its final result.
    Mirrors the AbortController / AbortSignal pattern.
    """

    def __init__(self) -> None:
        self._terminated = False
        self._result: AgentResult | Outcome | None = None

    @property
    def terminated(self) -> bool:
        return self._terminated

    @property
    def result(self) -> AgentResult | Outcome:
        if self._result is None:
            raise RuntimeError(
                "LoopController.result accessed before termination"
            )
        return self._result

    def terminate(self, result: AgentResult | Outcome) -> None:
        self._terminated = True
        self._result = result


class Loop:
    """The main agent loop.

    A pure Gemini function-calling orchestrator. Each call to ``run()``
    executes the agent loop until a termination function is called or
    an error occurs.
    """

    def __init__(
        self,
        *,
        access_token: str = "",
        controller: LoopController | None = None,
    ) -> None:
        self.controller = controller or LoopController()
        self._access_token = access_token

    async def run(self, args: AgentRunArgs) -> AgentResult | Outcome:
        """Execute the agent loop.

        Args:
            args: The run configuration (objective, function groups, hooks).

        Returns:
            AgentResult on success/failure, or an error Outcome dict.
        """
        hooks = args.hooks or LoopHooks()
        contents = args.contents or [args.objective]

        if hooks.on_start:
            hooks.on_start(args.objective)

        try:
            # Merge all function declarations into a single tool set
            all_declarations = []
            for group in args.function_groups:
                all_declarations.extend(group.declarations)

            tools = [{"functionDeclarations": all_declarations}]

            # Build the function definition map for dispatch
            definition_map: dict[str, Any] = {}
            for group in args.function_groups:
                for name, defn in group.definitions:
                    definition_map[name] = defn

            # Build system instruction from all group instructions
            system_instruction_parts = [
                group.instruction
                for group in args.function_groups
                if group.instruction
            ]
            system_instruction_text = "\n\n".join(system_instruction_parts)

            while not self.controller.terminated:
                body: GeminiBody = {
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 1,
                        "topP": 1,
                        "thinkingConfig": {
                            "includeThoughts": True,
                            "thinkingBudget": -1,
                        },
                    },
                    "toolConfig": {
                        "functionCallingConfig": {"mode": "ANY"},
                    },
                    "tools": tools,
                }

                if system_instruction_text:
                    body["systemInstruction"] = {
                        "parts": [{"text": system_instruction_text}],
                        "role": "user",
                    }

                if hooks.on_send_request:
                    hooks.on_send_request(AGENT_MODEL, body)

                # Stream from Gemini
                function_caller = FunctionCaller(definition_map)

                async for chunk in stream_generate_content(
                    AGENT_MODEL,
                    body,
                    access_token=self._access_token,
                ):
                    candidates = chunk.get("candidates", [])
                    if not candidates:
                        return err(
                            "Agent unable to proceed: "
                            "no candidates in Gemini response"
                        )

                    content = candidates[0].get("content")
                    if not content:
                        return err(
                            "Agent unable to proceed: "
                            "no content in Gemini response"
                        )

                    contents.append(content)
                    if hooks.on_content:
                        hooks.on_content(content)

                    parts = content.get("parts", [])
                    for part in parts:
                        # Handle thoughts
                        if part.get("thought"):
                            text = part.get("text", "")
                            if text and hooks.on_thought:
                                hooks.on_thought(text)

                        # Handle function calls
                        if "functionCall" in part:
                            func_def = definition_map.get(
                                part["functionCall"]["name"]
                            )

                            reporter = None
                            if hooks.on_function_call:
                                result = hooks.on_function_call(
                                    part,
                                    func_def.icon if func_def else None,
                                    func_def.title if func_def else None,
                                )
                                call_id = result.get(
                                    "call_id", str(uuid.uuid4())
                                )
                                reporter = result.get("reporter")
                            else:
                                call_id = str(uuid.uuid4())

                            def make_status_cb(cid: str) -> Any:
                                def cb(
                                    status: str | None, **kwargs: Any
                                ) -> None:
                                    if hooks.on_function_call_update:
                                        hooks.on_function_call_update(
                                            cid, status
                                        )

                                return cb

                            function_caller.call(
                                call_id,
                                part,
                                make_status_cb(call_id),
                                reporter,
                            )

                # Get function results
                function_results = await function_caller.get_results()
                if function_results is None:
                    continue

                # Report each function result individually
                if hooks.on_function_result:
                    for r in function_results["results"]:
                        hooks.on_function_result(
                            r.call_id,
                            {"parts": [r.response]},
                        )

                contents.append(function_results["combined"])
                if hooks.on_content:
                    hooks.on_content(function_results["combined"])

                if hooks.on_turn_complete:
                    hooks.on_turn_complete()

            return self.controller.result

        except Exception as e:
            error_message = str(e)
            logger.exception("Agent error")
            return err(f"Agent error: {error_message}")

        finally:
            if hooks.on_finish:
                hooks.on_finish()

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""AntigravityRunner — SessionRunner backed by the Antigravity SDK.

Wraps the Antigravity SDK's ``Agent`` → ``Conversation`` → ``receive_steps()``
pipeline into the ``SessionRunner`` / ``SessionStream`` protocols defined in
``bees.protocols.session``.

Each ``run()`` call:

1. Maps the bees function filter to SDK capabilities + custom tools.
2. Assembles system instructions from the provisioned segments.
3. Creates a ``LocalAgentConfig`` pointing at the agent's workspace.
4. Enters the ``Agent`` async context and sends the initial prompt.
5. Returns an ``AntigravityStream`` that translates SDK ``Step`` objects
   into ``SessionEvent`` dicts consumed by ``drain_session``.

``resume()`` recreates the Agent from a persisted ``save_dir`` and
``conversation_id``, sends the user's response, and returns a new stream.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import tempfile
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, Callable

from google.antigravity import types as ag_types
from google.antigravity.agent import Agent
from google.antigravity.connections.local.local_connection_config import (
    LocalAgentConfig,
)
from google.antigravity.hooks import policy

from bees.disk_file_system import DiskFileSystem
from bees.protocols.session import (
    SUSPEND_TYPES,
    SessionConfiguration,
    SessionEvent,
)
from bees.runners.tool_mapping import map_function_filter

__all__ = ["AntigravityRunner", "AntigravityStream"]

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Step → SessionEvent translation
# ---------------------------------------------------------------------------


def _format_usage(usage: ag_types.UsageMetadata) -> dict[str, Any]:
    """Convert SDK UsageMetadata to the dict shape drain_session expects."""
    return {
        k: v
        for k, v in {
            "promptTokenCount": usage.prompt_token_count,
            "candidatesTokenCount": usage.candidates_token_count,
            "thoughtsTokenCount": usage.thoughts_token_count,
            "cachedContentTokenCount": usage.cached_content_token_count,
            "totalTokenCount": usage.total_token_count,
        }.items()
        if v is not None
    }


def _build_complete_result(step: ag_types.Step) -> dict[str, Any]:
    """Build a ``complete`` event result dict from a FINISH step."""
    # The SDK's finish step carries structured_output when configured.
    # Map it to the bees outcome format.
    outcome_text = step.content or ""
    result: dict[str, Any] = {
        "success": step.status != ag_types.StepStatus.ERROR,
        "outcomes": {"parts": [{"text": outcome_text}]},
    }
    if step.structured_output is not None:
        result["structured_output"] = step.structured_output
    return result


def _translate_step(step: ag_types.Step) -> list[SessionEvent]:
    """Translate a single SDK Step into zero or more SessionEvent dicts."""
    events: list[SessionEvent] = []

    # Thinking delta → thought event.
    if step.thinking_delta:
        events.append({"thought": {"text": step.thinking_delta}})

    # Text delta from model → systemMessage event.
    if (
        step.content_delta
        and step.source == ag_types.StepSource.MODEL
        and step.target == ag_types.StepTarget.USER
    ):
        events.append({"systemMessage": {"text": step.content_delta}})

    # Tool calls → functionCall events.
    if step.tool_calls:
        for tc in step.tool_calls:
            name = tc.name
            if isinstance(name, ag_types.BuiltinTools):
                name = name.value
            events.append({
                "functionCall": {"name": name, "args": tc.args},
            })

    # Usage metadata → usageMetadata event.
    if step.usage_metadata:
        events.append({
            "usageMetadata": {"metadata": _format_usage(step.usage_metadata)},
        })

    # Finish → complete event.
    if (
        step.type == ag_types.StepType.FINISH
        and step.status == ag_types.StepStatus.DONE
    ):
        events.append({"complete": {"result": _build_complete_result(step)}})

    # Error → error event (terminal errors only).
    # Tool call errors (policy denials, missing files, etc.) are
    # intermediate — the model sees them and adapts.  Only emit
    # error events for steps that aren't tool calls, since those
    # represent unrecoverable model-level failures.
    if (
        step.status == ag_types.StepStatus.ERROR
        and step.type != ag_types.StepType.TOOL_CALL
    ):
        events.append({"error": {"message": step.error or "Unknown error"}})

    # NOTE: WAITING_FOR_USER steps are NOT translated to waitForInput.
    # The SDK's harness handles tool-approval prompts internally via
    # policies.  Emitting waitForInput for these intermediate steps
    # causes a false suspend in bees (the SDK continues processing
    # after auto-resolution, but the collector has already set
    # suspended=True).
    #
    # For interactive agents (M2), we'll implement a proper blocking
    # mechanism that bridges SDK user-input requests to bees suspend/
    # resume.

    return events


# ---------------------------------------------------------------------------
# System instruction assembly
# ---------------------------------------------------------------------------


def _assemble_system_instructions(
    config: SessionConfiguration,
) -> ag_types.TemplatedSystemInstructions:
    """Build SDK system instructions from bees session segments.

    Segments are the provisioned input (system prompt, function group
    instructions, skill instructions, etc.).  We pack them as named
    sections appended to the SDK's default template.
    """
    sections: list[ag_types.SystemInstructionSection] = []

    for i, segment in enumerate(config.segments):
        # Segments are dicts with a "text" key (from opal's segment format).
        text = segment.get("text", "")
        if not text:
            # Some segments carry only structured data (no text).
            continue
        title = segment.get("title", f"segment_{i}")
        sections.append(
            ag_types.SystemInstructionSection(content=text, title=title),
        )

    return ag_types.TemplatedSystemInstructions(sections=sections)


# ---------------------------------------------------------------------------
# AntigravityStream — SessionStream wrapping SDK's step stream
# ---------------------------------------------------------------------------


class _StubSessionHooks:
    """Minimal SessionHooks for tool_mapping when running outside opal."""

    def __init__(self, file_system: Any) -> None:
        self._file_system = file_system

    @property
    def controller(self) -> Any:
        return None

    @property
    def file_system(self) -> Any:
        return self._file_system

    @property
    def task_tree_manager(self) -> Any:
        return None


class AntigravityStream:
    """Async iterator over SDK steps, translated to ``SessionEvent`` dicts.

    Manages the ``Agent`` lifecycle: the agent context stays open while
    the stream is being iterated and is closed when the stream exhausts
    or encounters an error.

    Back-channel methods:

    - :meth:`send_context` — inject context into the running conversation.
    - :meth:`send_tool_response` — no-op (SDK dispatches tools internally).
    - :meth:`resume_state` — opaque blob for session resumption.
    """

    def __init__(
        self,
        *,
        agent: Agent,
        exit_stack: contextlib.AsyncExitStack,
        save_dir: str,
        initial_prompt: str,
        has_chat: bool = False,
        on_chat_entry: Callable[[str, str], None] | None = None,
    ) -> None:
        self._agent = agent
        self._exit_stack = exit_stack
        self._save_dir = save_dir
        self._initial_prompt = initial_prompt
        self._has_chat = has_chat
        self._on_chat_entry = on_chat_entry

        self._started = False
        self._exhausted = False
        self._step_iter: AsyncIterator[ag_types.Step] | None = None
        self._pending_events: list[SessionEvent] = []
        self._resume_blob: bytes | None = None
        self._emitted_send_request = False
        self._emitted_complete = False
        self._last_user_text: str = ""

    # -- async iterator ----------------------------------------------------

    def __aiter__(self) -> AsyncIterator[SessionEvent]:
        return self

    async def __anext__(self) -> SessionEvent:
        if self._exhausted:
            raise StopAsyncIteration

        # Drain any buffered events first.
        if self._pending_events:
            return self._pending_events.pop(0)

        # Synthesize the initial sendRequest event (once).
        if not self._emitted_send_request:
            self._emitted_send_request = True
            return {
                "sendRequest": {
                    "body": {
                        "contents": [
                            {
                                "role": "user",
                                "parts": [{"text": self._initial_prompt}],
                            },
                        ],
                    },
                },
            }

        # Start the conversation if not yet started.
        if not self._started:
            self._started = True
            try:
                await self._agent.conversation.send(self._initial_prompt)
                self._step_iter = self._agent.conversation.receive_steps()
            except Exception as exc:
                self._exhausted = True
                await self._cleanup()
                return {"error": {"message": str(exc)}}

        # Pull the next step from the SDK.
        assert self._step_iter is not None
        try:
            step = await self._step_iter.__anext__()
        except StopAsyncIteration:
            # The SDK turn is done — the agent went idle.
            self._exhausted = True
            self._capture_resume_state()

            if not self._emitted_complete:
                self._emitted_complete = True

                # Chat mode: idle without FINISH = waiting for user input.
                if self._has_chat and self._last_user_text:
                    # Log the model's message to the chat log.
                    if self._on_chat_entry:
                        self._on_chat_entry("agent", self._last_user_text)

                    # Don't tear down the agent yet — persist state for
                    # resume, but the cleanup still runs because the
                    # stream is done from drain_session's perspective.
                    await self._cleanup()
                    return {"waitForInput": {
                        "requestId": str(uuid.uuid4()),
                        "prompt": {
                            "parts": [{"text": self._last_user_text}],
                        },
                        "inputType": "text",
                    }}

                # Worker mode: idle without FINISH = done.
                await self._cleanup()
                return {"complete": {"result": {
                    "success": True,
                    "outcomes": {"parts": [{"text": ""}]},
                }}}

            await self._cleanup()
            raise
        except Exception as exc:
            self._exhausted = True
            await self._cleanup()
            return {"error": {"message": str(exc)}}

        # Translate the step into events.
        events = _translate_step(step)

        if not events:
            # Step produced no translatable events — skip to next.
            return await self.__anext__()

        # Track explicit completion events.
        # NOTE: error events from tool calls (e.g., policy denials) are
        # intermediate — the model recovers and continues.  Only
        # explicit complete events gate the idle synthesis.
        for event in events:
            if "complete" in event:
                self._emitted_complete = True

        # Accumulate user-directed text for chat mode suspend prompt.
        # Reset when a step has no systemMessage — tool calls, user
        # input replays, etc. clear the accumulator so only the LAST
        # contiguous model response becomes the suspend prompt.
        has_model_text = False
        for event in events:
            if "systemMessage" in event:
                has_model_text = True
                self._last_user_text += event["systemMessage"].get("text", "")
        if not has_model_text:
            self._last_user_text = ""

        # Check for suspend events — capture resume state eagerly.
        for event in events:
            if "waitForInput" in event or any(
                k in event for k in SUSPEND_TYPES
            ):
                self._capture_resume_state()
                break

        # Buffer all but the first event.
        first = events[0]
        self._pending_events.extend(events[1:])
        return first

    # -- back-channel methods ----------------------------------------------

    async def send_tool_response(
        self, responses: list[dict[str, Any]],
    ) -> None:
        """No-op — the SDK dispatches tools internally."""

    async def send_context(
        self, parts: list[dict[str, Any]],
    ) -> None:
        """Inject context parts into the running session.

        Sends a context-update message to the active conversation.
        The SDK will incorporate it as user input in the next turn.
        """
        text_parts = []
        for part in parts:
            if "text" in part:
                text_parts.append(part["text"])
        if text_parts:
            context_text = "\n\n".join(text_parts)
            try:
                await self._agent.conversation.send(context_text)
            except Exception:
                logger.warning(
                    "Failed to send context to Antigravity conversation",
                    exc_info=True,
                )

    def resume_state(self) -> bytes | None:
        """Opaque blob for session resumption.

        Returns a JSON-encoded dict with ``save_dir`` and
        ``conversation_id`` — everything needed to reconstruct the
        Agent on resume.  Returns ``None`` if the run completed
        normally.
        """
        return self._resume_blob

    # -- internal ----------------------------------------------------------

    def _capture_resume_state(self) -> None:
        """Capture resume state from the agent's conversation."""
        conversation_id = self._agent.conversation_id
        if conversation_id:
            blob = {
                "save_dir": self._save_dir,
                "conversation_id": conversation_id,
            }
            self._resume_blob = json.dumps(
                blob, ensure_ascii=False,
            ).encode("utf-8")

    async def _cleanup(self) -> None:
        """Close the Agent context manager and clean up resources."""
        try:
            await self._exit_stack.aclose()
        except Exception:
            logger.warning(
                "Error closing Antigravity agent context",
                exc_info=True,
            )


# ---------------------------------------------------------------------------
# AntigravityRunner — SessionRunner backed by the Antigravity SDK
# ---------------------------------------------------------------------------


class AntigravityRunner:
    """Concrete ``SessionRunner`` wrapping the Antigravity SDK.

    Each :meth:`run` / :meth:`resume` call creates an ``Agent`` with
    ``LocalAgentConfig``, enters the async context, and returns an
    :class:`AntigravityStream`.

    The runner holds only the API key — shared across sessions.
    """

    def __init__(self, *, api_key: str) -> None:
        self._api_key = api_key

    async def run(
        self,
        config: SessionConfiguration,
    ) -> AntigravityStream:
        """Start a new session and return an event stream.

        1. Map function_filter → SDK capabilities + custom tools.
        2. Assemble system instructions from config segments.
        3. Create LocalAgentConfig with workspace = fs_dir.
        4. Enter Agent context.
        5. Return AntigravityStream wrapping the conversation.
        """
        # 1. Map function filter to SDK capabilities.
        stub_hooks = _StubSessionHooks(config.file_system)
        capabilities, custom_tools = map_function_filter(
            config.function_filter,
            config.function_groups,
            stub_hooks,
        )

        # 2. Assemble system instructions.
        system_instructions = _assemble_system_instructions(config)

        # 3. Build workspace path.
        workspace = _workspace_path(config)

        # 4. Create a save_dir for session persistence.
        if config.ticket_dir:
            save_dir = str(config.ticket_dir / "antigravity_state")
        else:
            save_dir = tempfile.mkdtemp(prefix="bees-ag-")
        Path(save_dir).mkdir(parents=True, exist_ok=True)

        # 5. Build the LocalAgentConfig.
        agent_config = LocalAgentConfig(
            api_key=self._api_key,
            system_instructions=system_instructions,
            capabilities=capabilities,
            tools=custom_tools,
            policies=[policy.allow_all()],
            workspaces=[workspace],
            save_dir=save_dir,
            conversation_id=None,  # Fresh session.
        )

        # 6. Enter the Agent context.
        exit_stack = contextlib.AsyncExitStack()
        try:
            agent = await exit_stack.enter_async_context(Agent(agent_config))
        except Exception:
            await exit_stack.aclose()
            raise

        # 7. Extract the initial prompt from segments.
        initial_prompt = _extract_initial_prompt(config)

        # 8. Detect chat mode from function filter.
        has_chat = _has_chat_functions(config.function_filter)

        return AntigravityStream(
            agent=agent,
            exit_stack=exit_stack,
            save_dir=save_dir,
            initial_prompt=initial_prompt,
            has_chat=has_chat,
            on_chat_entry=config.on_chat_entry,
        )

    async def resume(
        self,
        config: SessionConfiguration,
        *,
        state: bytes,
        response: dict[str, Any],
        context_parts: list[dict[str, Any]] | None = None,
    ) -> AntigravityStream:
        """Resume a suspended session.

        Deserializes the resume blob to recover ``save_dir`` and
        ``conversation_id``, creates a new Agent with the saved
        conversation state, sends the user's response, and returns
        a new stream.
        """
        # 1. Deserialize resume state.
        resume_data = json.loads(state.decode("utf-8"))
        save_dir = resume_data["save_dir"]
        conversation_id = resume_data["conversation_id"]

        # 2. Map function filter to SDK capabilities (same as run).
        stub_hooks = _StubSessionHooks(config.file_system)
        capabilities, custom_tools = map_function_filter(
            config.function_filter,
            config.function_groups,
            stub_hooks,
        )

        # 3. Assemble system instructions.
        system_instructions = _assemble_system_instructions(config)

        # 4. Build workspace path.
        workspace = _workspace_path(config)

        # 5. Build the LocalAgentConfig with resume state.
        agent_config = LocalAgentConfig(
            api_key=self._api_key,
            system_instructions=system_instructions,
            capabilities=capabilities,
            tools=custom_tools,
            policies=[policy.allow_all()],
            workspaces=[workspace],
            save_dir=save_dir,
            conversation_id=conversation_id,
        )

        # 6. Enter the Agent context.
        exit_stack = contextlib.AsyncExitStack()
        try:
            agent = await exit_stack.enter_async_context(Agent(agent_config))
        except Exception:
            await exit_stack.aclose()
            raise

        # 7. Build the resume prompt from the user's response + context.
        resume_prompt = _build_resume_prompt(response, context_parts)

        # 8. Detect chat mode from function filter.
        has_chat = _has_chat_functions(config.function_filter)

        return AntigravityStream(
            agent=agent,
            exit_stack=exit_stack,
            save_dir=save_dir,
            initial_prompt=resume_prompt,
            has_chat=has_chat,
            on_chat_entry=config.on_chat_entry,
        )


# ---------------------------------------------------------------------------
# Prompt extraction
# ---------------------------------------------------------------------------


def _extract_initial_prompt(config: SessionConfiguration) -> str:
    """Extract the initial user prompt from session segments.

    Segments contain system instructions, function group instructions,
    and the actual user prompt.  The user prompt is typically the last
    segment with role='user' or the objective text.
    """
    # Collect all text from segments — the segments form the full
    # context that the Gemini runner would send as the initial request.
    # Since system instructions are handled separately, we extract
    # only user-facing content here.
    texts: list[str] = []
    for segment in config.segments:
        text = segment.get("text", "")
        if text:
            texts.append(text)

    return "\n\n".join(texts) if texts else "Begin."


def _workspace_path(config: SessionConfiguration) -> str:
    """Extract the workspace directory path from the session config.

    ``DiskFileSystem._work_dir`` is private, so we access it cautiously.
    Falls back to ``ticket_dir / 'filesystem'`` (the standard bees layout).
    """
    fs = config.file_system
    if isinstance(fs, DiskFileSystem) and hasattr(fs, "_work_dir"):
        return str(fs._work_dir)
    if config.ticket_dir:
        return str(config.ticket_dir / "filesystem")
    return tempfile.mkdtemp(prefix="bees-ag-ws-")


def _build_resume_prompt(
    response: dict[str, Any],
    context_parts: list[dict[str, Any]] | None = None,
) -> str:
    """Build a resume prompt from user response and context updates.

    The prompt combines any pending context updates with the user's
    direct response text.

    Handles multiple response shapes:
    - ``{"text": "..."}`` — direct text.
    - ``{"parts": [{"text": "..."}]}`` — LLMContent format.
    - ``{"input": {"parts": [{"text": "..."}]}}`` — waitForInput response
      from hivetool UI.
    """
    parts: list[str] = []

    # Prepend context updates if any.
    if context_parts:
        for part in context_parts:
            if "text" in part:
                parts.append(part["text"])

    # Extract the user's response text from various shapes.
    if "text" in response:
        parts.append(response["text"])
    elif "input" in response:
        # waitForInput response: {"input": {"parts": [{"text": "..."}]}}
        input_content = response["input"]
        if isinstance(input_content, dict):
            for p in input_content.get("parts", []):
                if "text" in p:
                    parts.append(p["text"])
    elif "parts" in response:
        for p in response["parts"]:
            if "text" in p:
                parts.append(p["text"])

    return "\n\n".join(parts) if parts else ""


def _has_chat_functions(function_filter: list[str] | None) -> bool:
    """Check if any function filter entry enables chat mode.

    Returns True if any filter starts with ``chat.``, indicating
    the agent is interactive and idle-without-FINISH should emit
    ``waitForInput`` instead of ``complete``.
    """
    if not function_filter:
        return False
    return any(f.startswith("chat.") for f in function_filter)

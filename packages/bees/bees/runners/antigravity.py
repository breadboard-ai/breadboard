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
from google.antigravity.hooks.hooks import HookContext, PostToolCallHook

from bees.disk_file_system import DiskFileSystem
from bees.protocols.handler_types import SuspendError
from bees.protocols.session import (
    SUSPEND_TYPES,
    SessionConfiguration,
    SessionEvent,
)
from bees.protocols.filesystem import FileSystem
from bees.runners.idle_resolution import IdleInputs, IdleOutcome, resolve_idle
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


async def _build_complete_result(
    step: ag_types.Step,
    file_system: FileSystem | None = None,
) -> dict[str, Any]:
    """Build a ``complete`` event result dict from a FINISH step."""
    # The SDK's finish step carries structured_output when configured.
    # Map it to the bees outcome format.
    outcome_text = step.content or ""
    if step.structured_output and isinstance(step.structured_output, dict):
        if "objective_outcome" in step.structured_output:
            outcome_text = step.structured_output["objective_outcome"]
        elif "user_message" in step.structured_output:
            outcome_text = step.structured_output["user_message"]

    from typing import cast
    outcomes: dict[str, Any]
    if file_system and outcome_text:
        from bees.pidgin import from_pidgin_string
        resolved = await from_pidgin_string(outcome_text, file_system)
        if isinstance(resolved, dict) and "$error" in resolved:
            # Fall back to raw text if resolution fails
            outcomes = {"parts": [{"text": outcome_text}]}
        else:
            outcomes = cast(dict[str, Any], resolved)
    else:
        outcomes = {"parts": [{"text": outcome_text}]}

    result: dict[str, Any] = {
        "success": step.status != ag_types.StepStatus.ERROR,
        "outcomes": outcomes,
    }
    if step.structured_output is not None:
        result["structured_output"] = step.structured_output

    if file_system:
        # Collect intermediate files.
        intermediate = []
        for path in list(file_system.files.keys()):
            file_parts = await file_system.get(path)
            if isinstance(file_parts, dict) and "$error" in file_parts:
                continue
            if file_parts:
                intermediate.append({
                    "path": path,
                    "content": {"parts": file_parts},
                })
        result["intermediate"] = intermediate

    return result


async def _translate_step(
    step: ag_types.Step,
    file_system: FileSystem | None = None,
) -> list[SessionEvent]:
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

    # Tool calls.
    # The SDK may emit TOOL_CALL steps more than once per invocation
    # (ACTIVE → DONE).  We only emit functionCall for the initial
    # ACTIVE step.  functionResponse events are captured separately
    # via a PostToolCallHook (see _ToolResultCapture).
    if step.tool_calls and step.status != ag_types.StepStatus.DONE:
        for tc in step.tool_calls:
            name = tc.name
            if isinstance(name, ag_types.BuiltinTools):
                name = name.value
            events.append(
                {"functionCall": {"name": name, "args": tc.args}},
            )

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
        complete_result = await _build_complete_result(step, file_system)
        events.append({"complete": {"result": complete_result}})

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
# Request config assembly (for Hivetool session header)
# ---------------------------------------------------------------------------


def _build_request_config(
    capabilities: ag_types.CapabilitiesConfig,
    custom_tools: list[Callable[..., Any]],
    system_instructions: ag_types.CustomSystemInstructions,
) -> dict[str, Any]:
    """Build the Hivetool-compatible config dict for the sendRequest body.

    Produces ``systemInstruction`` and ``tools`` fields so Hivetool's
    session header can render the system prompt and tool list.
    """
    result: dict[str, Any] = {}

    if system_instructions:
        result["systemInstruction"] = {"parts": [{"text": system_instructions.text}]}

    # Tools: combine SDK builtins + custom tool names.
    declarations: list[dict[str, str]] = []
    for bt in capabilities.enabled_tools:
        name = bt.value if hasattr(bt, "value") else str(bt)
        declarations.append({"name": name})
    for tool in custom_tools:
        declarations.append({"name": getattr(tool, "__name__", "unknown")})
    if declarations:
        result["tools"] = [{"functionDeclarations": declarations}]

    return result


# ---------------------------------------------------------------------------
# System instruction assembly
# ---------------------------------------------------------------------------


AGENT_IDENTITY = (
    "You are an LLM-powered AI agent, orchestrated within an application alongside "
    "other AI agents. During this session, your job is to fulfill the objective, "
    "specified at the start of the conversation context. The objective is provided by "
    "the application and is not visible to the user of the application. Similarly, "
    "the outcome you produce is delivered by the orchestration system to another "
    "agent. The outcome is also not visible to the user to the application."
)

FILES_INSTRUCTION_ANTIGRAVITY = """## Passing around files

You can pass files around using the `<file src="filename.ext" />` syntax.

Use the <file> tag to present the files to the user. 

The post-processing parser replaces each `<file>` tag with the file's
contents. Make sure your output reads well after the replacement.

Only reference files that you know to exist. Hypothetical file tags they will cause processing errors.
"""


def _assemble_system_instructions(
    active_instructions: list[str],
    has_files: bool = False,
) -> ag_types.CustomSystemInstructions:
    """Build SDK system instructions from all active tool group instructions.

    Compiles a structured custom system prompt containing the core identity
    and active tool guidelines/meta-plan. Bypasses harness defaults to maximize
    context caching and prevent instruction leakage.
    """
    identity_block = f"<identity>\n{AGENT_IDENTITY}\n</identity>"

    instructions_parts = [inst.strip() for inst in active_instructions if inst.strip()]
    if has_files:
        instructions_parts.append(FILES_INSTRUCTION_ANTIGRAVITY.strip())
    active_text = "\n\n".join(instructions_parts)

    final_prompt = f"{identity_block}\n\n{active_text}"
    return ag_types.CustomSystemInstructions(text=final_prompt)


# ---------------------------------------------------------------------------
# PostToolCallHook — captures tool results for functionResponse events
# ---------------------------------------------------------------------------


class _ToolResultCapture(PostToolCallHook):
    """Observes tool completions and queues results for event emission.

    Registered as a hook on the Agent so it fires for every tool call
    — both SDK built-in tools (file ops, shell) and custom host-side
    tools (agents_*, events_*).  Results are pushed to an asyncio.Queue
    that the AntigravityStream drains into ``functionResponse`` events.
    """

    def __init__(self, queue: asyncio.Queue[tuple[str, Any]]) -> None:
        self._queue = queue

    async def run(
        self, context: HookContext, data: ag_types.ToolResult,
    ) -> None:
        self._queue.put_nowait(("tool_result", data))


def _tool_result_to_event(
    result: ag_types.ToolResult,
) -> dict[str, Any]:
    """Convert a ToolResult into a ``functionResponse`` SessionEvent."""
    name = result.name
    if isinstance(name, ag_types.BuiltinTools):
        name = name.value
    response = result.result
    # SDK builtin tools return Pydantic BaseModel instances
    # (SearchDirectoryResult, EditFileResult, etc.) that aren't
    # JSON-serializable.  Normalize to plain dicts early so the
    # downstream isinstance checks and json.dumps work correctly.
    if hasattr(response, "model_dump"):
        response = response.model_dump()
    if result.error:
        response = {"error": result.error}
    elif response is None:
        response = {}
    elif not isinstance(response, dict):
        # Wrap scalars / lists so the value is always a JSON object.
        response = {"result": response}
    return {
        "functionResponse": {
            "name": name,
            "response": response,
        },
    }


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
        request_config: dict[str, Any] | None = None,
        sdk_event_queue: asyncio.Queue[tuple[str, Any]] | None = None,
        suspend_queue: asyncio.Queue[SuspendError] | None = None,
        resume_after_step: int = -1,
        file_system: FileSystem | None = None,
        ticket_dir: Path | None = None,
    ) -> None:
        self._agent = agent
        self._exit_stack = exit_stack
        self._save_dir = save_dir
        self._initial_prompt = initial_prompt
        self._has_chat = has_chat
        self._on_chat_entry = on_chat_entry
        self._request_config = request_config or {}
        self._sdk_event_queue: asyncio.Queue[tuple[str, Any]] = (
            sdk_event_queue or asyncio.Queue()
        )
        self._suspend_queue: asyncio.Queue[SuspendError] = (
            suspend_queue or asyncio.Queue()
        )
        self._file_system = file_system
        self._ticket_dir = ticket_dir

        self._started = False
        self._exhausted = False
        self._reader_task: asyncio.Task[None] | None = None
        self._pending_events: list[SessionEvent] = []
        self._resume_blob: bytes | None = None
        self._emitted_send_request = False
        self._emitted_complete = False
        self._last_user_text: str = ""
        self._pending_suspend: SuspendError | None = None
        # On resume, skip steps replayed from the prior trajectory.
        # Steps with step_index <= this value are old history.
        self._resume_after_step = resume_after_step
        # Track highest step_index seen for the resume blob.
        self._last_step_index: int = -1

    # -- async iterator ----------------------------------------------------

    def __aiter__(self) -> AsyncIterator[SessionEvent]:
        return self

    async def _read_steps(self) -> None:
        """Background task that reads steps from the SDK conversation and pushes them."""
        try:
            async for step in self._agent.conversation.receive_steps():
                await self._sdk_event_queue.put(("step", step))
        except Exception as exc:
            await self._sdk_event_queue.put(("error", exc))
        finally:
            await self._sdk_event_queue.put(("done", None))

    async def __anext__(self) -> SessionEvent:
        if self._exhausted:
            raise StopAsyncIteration

        # Drain any buffered events first.
        if self._pending_events:
            return self._pending_events.pop(0)

        # Synthesize the initial sendRequest event (once).
        if not self._emitted_send_request:
            self._emitted_send_request = True
            body: dict[str, Any] = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": self._initial_prompt}],
                    },
                ],
                **self._request_config,
            }
            return {"sendRequest": {"body": body}}

        # Start the conversation if not yet started.
        if not self._started:
            self._started = True
            try:
                await self._agent.conversation.send(self._initial_prompt)
                self._reader_task = asyncio.create_task(self._read_steps())
            except Exception as exc:
                self._exhausted = True
                await self._cleanup()
                return {"error": {"message": str(exc)}}

        while True:
            try:
                tag, val = await self._sdk_event_queue.get()
            except asyncio.CancelledError:
                raise StopAsyncIteration

            if tag == "error":
                self._exhausted = True
                await self._cleanup()
                return {"error": {"message": str(val)}}

            elif tag == "tool_result":
                return _tool_result_to_event(val)

            elif tag == "step":
                step = val
                if (
                    step.step_index == 1
                    and step.type == ag_types.StepType.TOOL_CALL
                    and step.step_index <= self._last_step_index
                ):
                    # Custom tool calls generated by the client have hardcoded step_index = 1.
                    # To prevent them from being skipped as replays, adjust the step index.
                    step = step.model_copy(update={"step_index": self._last_step_index + 1})

                self._last_step_index = max(
                    self._last_step_index, step.step_index,
                )
                # On resume, skip steps replayed from prior turns.
                if step.step_index <= self._resume_after_step:
                    continue

                # Translate the step into events.
                events = await _translate_step(step, self._file_system)

                if not events:
                    # Step produced no translatable events — skip to next.
                    continue

                # Track explicit completion events.
                for event in events:
                    if "complete" in event:
                        self._emitted_complete = True

                # Accumulate user-directed text for chat mode suspend prompt.
                has_model_text = False
                has_active_content = False
                for event in events:
                    if "systemMessage" in event:
                        has_model_text = True
                        self._last_user_text += event["systemMessage"].get("text", "")
                    if "functionCall" in event or "thought" in event:
                        has_active_content = True
                if has_active_content and not has_model_text:
                    self._last_user_text = ""

                # Check for deferred suspends from tool wrappers.
                if not self._pending_suspend:
                    try:
                        self._pending_suspend = self._suspend_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass

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

            elif tag == "done":
                # The SDK turn is done — the agent went idle.
                self._capture_resume_state()

                self._exhausted = True
                if not self._emitted_complete:
                    idle_inputs = self._build_idle_inputs()
                    outcome, event = resolve_idle(idle_inputs)
                    self._emitted_complete = True

                    # Side effect: log model text to chat log.
                    if (
                        outcome == IdleOutcome.SUSPEND_CHAT
                        and self._last_user_text
                        and self._on_chat_entry
                    ):
                        self._on_chat_entry("agent", self._last_user_text)

                    await self._cleanup()
                    if outcome == IdleOutcome.ALREADY_COMPLETE:
                        raise StopAsyncIteration
                    return event

                await self._cleanup()
                raise StopAsyncIteration

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

    def _build_idle_inputs(self) -> IdleInputs:
        """Gather accumulated state for the idle resolution state machine."""
        has_active_tasks = False
        if self._ticket_dir:
            from bees.unified_agent_store import UnifiedAgentStore
            try:
                store = UnifiedAgentStore(self._ticket_dir.parent.parent)
                caller_agent_id = self._ticket_dir.name
                has_active_tasks = store.has_pending_tasks(caller_agent_id)
            except Exception:
                logger.warning(
                    "Failed to query active tasks in AntigravityStream",
                    exc_info=True,
                )

        return IdleInputs(
            emitted_complete=self._emitted_complete,
            pending_suspend=self._pending_suspend is not None,
            suspend_request_id=(
                self._pending_suspend.interaction_id
                if self._pending_suspend
                else ""
            ),
            has_active_tasks=has_active_tasks,
            has_chat=self._has_chat,
            last_user_text=self._last_user_text,
        )


    def _capture_resume_state(self) -> None:
        """Capture resume state from the agent's conversation."""
        conversation_id = self._agent.conversation_id
        if conversation_id:
            blob = {
                "save_dir": self._save_dir,
                "conversation_id": conversation_id,
                "last_step_index": self._last_step_index,
            }
            self._resume_blob = json.dumps(
                blob, ensure_ascii=False,
            ).encode("utf-8")

    async def _cleanup(self) -> None:
        """Close the Agent context manager and clean up resources."""
        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._reader_task
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
        capabilities, custom_tools, custom_instructions, suspend_queue = (
            map_function_filter(
                config.function_filter,
                config.function_groups,
                stub_hooks,
            )
        )

        # 2. Assemble system instructions from all active tool groups.
        has_files = (config.function_filter is None) or any(
            pattern.startswith("files")
            for pattern in config.function_filter
        )
        system_instructions = _assemble_system_instructions(
            custom_instructions,
            has_files=has_files,
        )

        # 3. Build workspace path.
        workspace = _workspace_path(config)

        # 4. Create a save_dir for session persistence.
        if config.ticket_dir:
            save_dir = str(config.ticket_dir / "antigravity_state")
        else:
            save_dir = tempfile.mkdtemp(prefix="bees-ag-")
        Path(save_dir).mkdir(parents=True, exist_ok=True)

        # 5. Build the hook that captures tool results.
        sdk_event_queue: asyncio.Queue[tuple[str, Any]] = (
            asyncio.Queue()
        )
        tool_result_hook = _ToolResultCapture(sdk_event_queue)

        # 6. Build the LocalAgentConfig.
        agent_config = LocalAgentConfig(
            api_key=self._api_key,
            system_instructions=system_instructions,
            capabilities=capabilities,
            tools=custom_tools,
            policies=[policy.allow_all()],
            hooks=[tool_result_hook],
            workspaces=[workspace],
            save_dir=save_dir,
            conversation_id=None,  # Fresh session.
        )

        # 7. Enter the Agent context.
        exit_stack = contextlib.AsyncExitStack()
        try:
            agent = await exit_stack.enter_async_context(Agent(agent_config))
        except Exception:
            await exit_stack.aclose()
            raise

        # 8. Extract the initial prompt from segments.
        initial_prompt = _extract_initial_prompt(config)

        # 9. Detect chat mode from function filter.
        has_chat = _has_chat_functions(config.function_filter)

        request_config = _build_request_config(
            capabilities, custom_tools, system_instructions,
        )

        return AntigravityStream(
            agent=agent,
            exit_stack=exit_stack,
            save_dir=save_dir,
            initial_prompt=initial_prompt,
            has_chat=has_chat,
            on_chat_entry=config.on_chat_entry,
            request_config=request_config,
            sdk_event_queue=sdk_event_queue,
            suspend_queue=suspend_queue,
            file_system=config.file_system,
            ticket_dir=config.ticket_dir,
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
        last_step_index = resume_data.get("last_step_index", -1)

        # 2. Map function filter to SDK capabilities (same as run).
        stub_hooks = _StubSessionHooks(config.file_system)
        capabilities, custom_tools, custom_instructions, suspend_queue = (
            map_function_filter(
                config.function_filter,
                config.function_groups,
                stub_hooks,
            )
        )

        # 3. Assemble system instructions from all active tool groups.
        has_files = (config.function_filter is None) or any(
            pattern.startswith("files")
            for pattern in config.function_filter
        )
        system_instructions = _assemble_system_instructions(
            custom_instructions,
            has_files=has_files,
        )

        # 4. Build workspace path.
        workspace = _workspace_path(config)

        # 5. Build the hook that captures tool results.
        sdk_event_queue: asyncio.Queue[tuple[str, Any]] = (
            asyncio.Queue()
        )
        tool_result_hook = _ToolResultCapture(sdk_event_queue)

        # 6. Build the LocalAgentConfig with resume state.
        agent_config = LocalAgentConfig(
            api_key=self._api_key,
            system_instructions=system_instructions,
            capabilities=capabilities,
            tools=custom_tools,
            policies=[policy.allow_all()],
            hooks=[tool_result_hook],
            workspaces=[workspace],
            save_dir=save_dir,
            conversation_id=conversation_id,
        )

        # 7. Enter the Agent context.
        exit_stack = contextlib.AsyncExitStack()
        try:
            agent = await exit_stack.enter_async_context(Agent(agent_config))
        except Exception:
            await exit_stack.aclose()
            raise

        # 8. Build the resume prompt from the user's response + context.
        resume_prompt = _build_resume_prompt(response, context_parts)

        # 9. Detect chat mode from function filter.
        has_chat = _has_chat_functions(config.function_filter)

        request_config = _build_request_config(
            capabilities, custom_tools, system_instructions,
        )

        return AntigravityStream(
            agent=agent,
            exit_stack=exit_stack,
            save_dir=save_dir,
            initial_prompt=resume_prompt,
            has_chat=has_chat,
            on_chat_entry=config.on_chat_entry,
            request_config=request_config,
            sdk_event_queue=sdk_event_queue,
            suspend_queue=suspend_queue,
            resume_after_step=last_step_index,
            file_system=config.file_system,
            ticket_dir=config.ticket_dir,
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
    from datetime import datetime

    # Collect all text from segments — the segments form the full
    # context that the Gemini runner would send as the initial request.
    # Since system instructions are handled separately, we extract
    # only user-facing content here.
    texts: list[str] = []
    for segment in config.segments:
        text = segment.get("text", "")
        if text:
            texts.append(text)

    objective_text = "\n\n".join(texts) if texts else "Begin."

    now = datetime.now().strftime("%B %-d, %Y %-I:%M %p")
    workspace = _workspace_path(config)
    metadata_block = f"<metadata>\n<current_date>{now}</current_date>\n<working_directory>{workspace}</working_directory>\n</metadata>"

    # Check if sandbox orientation is needed
    has_files_or_sandbox = False
    if config.function_filter is None:
        has_files_or_sandbox = True
    else:
        has_files_or_sandbox = any(
            pattern.startswith("files") or pattern.startswith("sandbox")
            for pattern in config.function_filter
        )

    slug = None
    if config.ticket_dir and (config.ticket_dir / "metadata.json").is_file():
        try:
            mdata = json.loads((config.ticket_dir / "metadata.json").read_text(encoding="utf-8"))
            slug = mdata.get("slug")
        except Exception:
            pass

    if has_files_or_sandbox and "<sandbox_environment>" not in objective_text:
        if slug:
            sandbox_block = (
                "<sandbox_environment>\n"
                "Your current working directory is the root of the workspace.\n"
                f"You are assigned to work in the subdirectory: ./{slug}\n"
                f"CRITICAL: You must prefix all file paths with {slug}/ "
                "when creating or writing files (e.g., using files_write_file or "
                "redirection in bash). Writes to the root directory or other "
                "directories will fail.\n"
                "You can read files from anywhere in the workspace.\n"
                "</sandbox_environment>"
            )
        else:
            sandbox_block = (
                "<sandbox_environment>\n"
                "Your current working directory is the root of the workspace.\n"
                "You can read files from anywhere in the workspace.\n"
                "</sandbox_environment>"
            )
        objective_text = f"{objective_text}\n\n{sandbox_block}"

    return f"{metadata_block}\n<objective>{objective_text}</objective>"


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

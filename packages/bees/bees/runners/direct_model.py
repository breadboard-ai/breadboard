# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""DirectModelRunner — SessionRunner for direct non-blocking model execution.

Executes tasks directly via model API calls (like text or image generation)
without entering a multi-turn agent loop or registering system/file tools.
Satisfies standard SessionRunner and SessionStream protocols.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from bees.protocols.session import SessionConfiguration, SessionEvent, SessionResult
from opal_backend.local.backend_client_impl import HttpBackendClient
from bees.pidgin import from_pidgin_string
from opal_backend.gemini_client import stream_generate_content
from opal_backend.sessions.file_store import FileBasedSessionStore
from opal_backend.sessions.in_memory_store import InMemorySessionStore
from opal_backend.sessions.store import SessionStore

logger = logging.getLogger("bees.runners.direct_model")


class DirectModelStream:
    """SessionStream for DirectModelRunner.

    Runs a single-turn model generation in a background task, yielding
    streaming thoughts/content events, and writing deliverables to the task's
    slug sandbox workspace on completion.
    """

    def __init__(
        self,
        queue: asyncio.Queue[SessionEvent | None],
        config: SessionConfiguration,
        backend: HttpBackendClient,
        session_store: SessionStore,
        task: asyncio.Task[None] | None = None,
    ) -> None:
        self._queue = queue
        self._config = config
        self._backend = backend
        self._session_store = session_store
        self._task = task
        self._exhausted = False

    def set_task(self, task: asyncio.Task[None]) -> None:
        """Set the background execution task."""
        self._task = task

    async def _log_event(self, event: dict[str, Any]) -> None:
        """Enqueue the event and append it to the session store."""
        self._queue.put_nowait(event)
        if self._config.session_id:
            try:
                await self._session_store.append_event(self._config.session_id, event)
            except Exception as e:
                logger.warning("Failed to write session event: %s", e)

    def __aiter__(self) -> AsyncIterator[SessionEvent]:
        return self

    async def __anext__(self) -> SessionEvent:
        if self._exhausted:
            raise StopAsyncIteration

        event = await self._queue.get()
        if event is None:
            self._exhausted = True
            raise StopAsyncIteration

        return event

    async def send_tool_response(
        self, responses: list[dict[str, Any]],
    ) -> None:
        """No-op — direct model runner doesn't execute function call steps."""
        pass

    async def send_context(
        self, parts: list[dict[str, Any]],
    ) -> None:
        """No-op — direct model runner is single-turn and non-interactive."""
        pass

    def resume_state(self) -> bytes | None:
        """None — direct model generation is atomic and never suspends."""
        return None

    async def _execute(self) -> None:
        if self._config.session_id:
            try:
                await self._session_store.create(self._config.session_id)
            except Exception as e:
                logger.warning("Failed to initialize session store: %s", e)

        try:
            # 1. Read metadata.json to get slug and other config
            slug = None
            if self._config.ticket_dir:
                metadata_path = self._config.ticket_dir / "metadata.json"
                if metadata_path.is_file():
                    try:
                        mdata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        slug = mdata.get("slug")
                    except Exception as e:
                        logger.warning("Failed to load task metadata: %s", e)

            # 2. Dispatch based on function filtering / tags
            # In Phase 1, we implement the baseline TextAdapter
            await self._run_text_adapter(slug)

            # 3. Update session status to completed
            if self._config.session_id:
                await self._session_store.set_status(self._config.session_id, "completed")

        except Exception as e:
            logger.exception("DirectModel runner failed")
            err_event = {"error": {"message": str(e)}}
            await self._log_event(err_event)
            if self._config.session_id:
                await self._session_store.set_status(self._config.session_id, "failed")
        finally:
            self._queue.put_nowait(None)

    async def _run_text_adapter(self, slug: str | None) -> None:
        # Combine text segments to form prompt
        prompt_parts = []
        for segment in self._config.segments:
            seg_type = segment.get("type")
            if seg_type == "text":
                text = segment.get("text", "")
                if text:
                    prompt_parts.append(text)
            elif seg_type == "input":
                content = segment.get("content", {})
                for part in content.get("parts", []):
                    if "text" in part:
                        prompt_parts.append(part["text"])

        prompt = "\n".join(prompt_parts).strip()

        # Fallback to objective.md if prompt is empty
        if not prompt and self._config.ticket_dir:
            objective_path = self._config.ticket_dir / "objective.md"
            if objective_path.is_file():
                prompt = objective_path.read_text(encoding="utf-8").strip()

        if not prompt:
            raise ValueError("Direct model generation failed: Empty prompt / objective")

        # Translate pidgin references (resolving files)
        translated = await from_pidgin_string(prompt, self._config.file_system)
        if isinstance(translated, dict) and "$error" in translated:
            raise ValueError(translated["$error"])

        # Resolve model configuration
        model = self._config.model or "gemini-3-flash-preview"
        if model == "pro":
            resolved_model = "gemini-3.1-pro-preview"
        elif model == "flash":
            resolved_model = "gemini-3-flash-preview"
        elif model == "lite":
            resolved_model = "gemini-2.5-flash-lite"
        else:
            resolved_model = model

        # Setup generation configuration
        generation_config: dict[str, Any] = {}
        if "pro" in resolved_model:
            generation_config["thinkingConfig"] = {
                "includeThoughts": True,
                "thinkingLevel": "high",
            }

        # System instructions to enforce clean direct formatting
        DEFAULT_SYSTEM_INSTRUCTION = {
            "parts": [
                {
                    "text": (
                        "You are working as part of an AI system, so no chit-chat "
                        "and no explaining what you're doing and why.\n"
                        'DO NOT start with "Okay", or "Alright" or any preambles. '
                        "Just the output, please."
                    )
                }
            ],
            "role": "user",
        }

        body: dict[str, Any] = {
            "systemInstruction": DEFAULT_SYSTEM_INSTRUCTION,
            "contents": [translated],
            "generationConfig": generation_config,
        }

        # Log the starting sendRequest event to events.jsonl for Hivetool telemetry
        send_request_event = {
            "sendRequest": {
                "body": {
                    "model": resolved_model,
                    "contents": [translated],
                    "generationConfig": generation_config,
                }
            }
        }
        await self._log_event(send_request_event)

        # Grounding tools integration based on builtin capability names
        tools: list[dict[str, Any]] = []
        if self._config.function_filter:
            if "builtin.search_grounding" in self._config.function_filter:
                tools.append({"googleSearch": {}})
            if "builtin.maps_grounding" in self._config.function_filter:
                tools.append({"googleMaps": {}})
            if "builtin.url_context" in self._config.function_filter:
                tools.append({"urlContext": {}})

        if tools:
            body["tools"] = tools

            # Update logged sendRequest tools list to match
            send_request_event["sendRequest"]["body"]["tools"] = tools

        result_parts: list[dict[str, Any]] = []

        async for chunk in stream_generate_content(
            resolved_model, body, backend=self._backend
        ):
            candidates = chunk.get("candidates", [])
            if not candidates:
                continue
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                if not part:
                    continue
                if "text" in part:
                    if part.get("thought"):
                        await self._log_event({"thought": {"text": part["text"]}})
                    else:
                        result_parts.append(part)

        from bees.pidgin import merge_text_parts
        merged = merge_text_parts(result_parts, separator="")
        final_text = "".join(p["text"] for p in merged if "text" in p)

        if not final_text:
            raise ValueError("No text was generated. Please try again")

        # Resolve the sandboxed workspace write path
        output_path = f"{slug}/text.md" if slug else "text.md"
        self._config.file_system.write(output_path, final_text)

        # Yield standard successful completion event
        complete_event = {
            "complete": {
                "result": {
                    "success": True,
                    "outcomes": {
                        "parts": [{"text": f"Result written to {output_path}"}]
                    },
                    "intermediate": [
                        {
                            "path": output_path,
                            "content": {"text": final_text}
                        }
                    ]
                }
            }
        }
        await self._log_event(complete_event)


class DirectModelRunner:
    """Concrete SessionRunner wrapping direct generation adapters."""

    def __init__(self, backend: HttpBackendClient) -> None:
        self._backend = backend

    async def run(self, config: SessionConfiguration) -> DirectModelStream:
        if config.ticket_dir:
            session_store = FileBasedSessionStore(config.ticket_dir / "sessions")
        else:
            session_store = InMemorySessionStore()

        queue = asyncio.Queue()
        stream = DirectModelStream(
            queue=queue,
            config=config,
            backend=self._backend,
            session_store=session_store,
        )
        task = asyncio.create_task(stream._execute())
        stream.set_task(task)
        return stream

    async def resume(
        self,
        config: SessionConfiguration,
        *,
        state: bytes,
        response: dict[str, Any],
        context_parts: list[dict[str, Any]] | None = None,
    ) -> DirectModelStream:
        raise NotImplementedError("DirectModelRunner does not support resume")

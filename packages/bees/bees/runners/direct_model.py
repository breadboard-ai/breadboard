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
from opal_backend.sessions.file_store import FileBasedSessionStore
from opal_backend.sessions.in_memory_store import InMemorySessionStore
from opal_backend.sessions.store import SessionStore
from bees.runners.adapters import GenAdapter, ImageAdapter, MusicAdapter, SpeechAdapter, TextAdapter, VideoAdapter

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
        api_key: str = "",
    ) -> None:
        self._queue = queue
        self._config = config
        self._backend = backend
        self._session_store = session_store
        self._task = task
        self._api_key = api_key
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
            tags = []
            if self._config.ticket_dir:
                metadata_path = self._config.ticket_dir / "metadata.json"
                if metadata_path.is_file():
                    try:
                        mdata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        slug = mdata.get("slug")
                        tags = mdata.get("tags") or []
                    except Exception as e:
                        logger.warning("Failed to load task metadata: %s", e)

            # 2. Dispatch based on function filtering / tags
            adapter: GenAdapter = TextAdapter()
            if "image" in tags:
                adapter = ImageAdapter()
            elif "video" in tags:
                adapter = VideoAdapter()
            elif "speech" in tags:
                adapter = SpeechAdapter()
            elif "music" in tags:
                adapter = MusicAdapter()

            await adapter.generate(
                self._config,
                slug,
                self._log_event,
                self._backend,
                self._api_key,
            )

            # 3. Update session status to completed
            if self._config.session_id:
                await self._session_store.set_status(self._config.session_id, "completed")

        except Exception as e:
            logger.exception("DirectModel runner failed")
            if hasattr(e, "error_dict"):
                err_event = {
                    "error": {
                        "message": getattr(e, "error_dict").get("error", str(e)),
                        "metadata": getattr(e, "error_dict").get("metadata"),
                    }
                }
            else:
                err_event = {"error": {"message": str(e)}}
            await self._log_event(err_event)
            if self._config.session_id:
                await self._session_store.set_status(self._config.session_id, "failed")
        finally:
            self._queue.put_nowait(None)


class DirectModelRunner:
    """Concrete SessionRunner wrapping direct generation adapters."""

    def __init__(self, backend: HttpBackendClient, api_key: str = "") -> None:
        self._backend = backend
        self._api_key = api_key

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
            api_key=self._api_key,
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



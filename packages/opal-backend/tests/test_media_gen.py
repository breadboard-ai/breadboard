# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for media_gen_handler (image, audio, video, music)."""

from __future__ import annotations

import base64
import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from opal_backend.node_handlers import (
    MediaModeConfig,
    MEDIA_MODES,
    NodeHandlerDeps,
    dispatch_handler,
    media_gen_handler,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_deps(
    execute_step_response: dict | None = None,
    assets: dict | None = None,
) -> NodeHandlerDeps:
    """Build NodeHandlerDeps with a mocked backend."""
    backend = MagicMock()
    if execute_step_response is not None:
        backend.execute_step = AsyncMock(return_value=execute_step_response)
    else:
        backend.execute_step = AsyncMock(return_value={})
    return NodeHandlerDeps(
        on_agent_event=AsyncMock(),
        run_agent_fn=None,
        backend=backend,
        interaction_store=None,
        assets=assets,
    )


def _execute_step_response(
    output_key: str,
    chunks: list[dict],
) -> dict:
    """Build an executeStep API response."""
    return {
        "executionOutputs": {
            output_key: {
                "chunks": chunks,
            },
        },
    }


def _text_chunk(text: str) -> dict:
    """Build an inline text chunk."""
    encoded = base64.b64encode(text.encode()).decode()
    return {"mimetype": "text/plain", "data": encoded}


def _image_chunk() -> dict:
    """Build an inline image chunk."""
    return {"mimetype": "image/png", "data": "iVBORw0KGgo="}


def _stored_data_chunk(blob_id: str) -> dict:
    """Build a storedData chunk (GCS path)."""
    return {"mimetype": "image/png/storedData", "data": f"bucket/{blob_id}"}


# ---------------------------------------------------------------------------
# Mode config registry
# ---------------------------------------------------------------------------

class TestMediaModeRegistry:
    """Test the MEDIA_MODES registry."""

    def test_all_active_modes_registered(self):
        """All non-hidden active media modes are in the registry."""
        expected = {"image", "image-pro", "audio", "video", "music"}
        assert set(MEDIA_MODES.keys()) == expected

    def test_image_config(self):
        config = MEDIA_MODES["image"]
        assert config.model_api == "ai_image_tool"
        assert config.step_name == "EditImage"
        assert config.output_key == "edited_image"
        assert config.prompt_input_key == "input_instruction"

    def test_audio_config(self):
        config = MEDIA_MODES["audio"]
        assert config.model_api == "tts"
        assert config.step_name == "GenerateAudio"
        assert config.output_key == "generated_speech"
        assert config.prompt_input_key == "text_to_speak"

    def test_video_config(self):
        config = MEDIA_MODES["video"]
        assert config.model_api == "generate_video"
        assert config.step_name == "GenerateVideo"
        assert config.output_key == "generated_video"
        assert config.prompt_input_key == "text_instruction"

    def test_music_config(self):
        config = MEDIA_MODES["music"]
        assert config.model_api == "generate_music"
        assert config.step_name == "GenerateMusic"
        assert config.output_key == "generated_music"
        assert config.prompt_input_key == "prompt"


# ---------------------------------------------------------------------------
# Dispatch routing
# ---------------------------------------------------------------------------

class TestDispatchRouting:
    """Test that dispatch_handler routes to media_gen_handler."""

    @pytest.mark.asyncio
    async def test_image_mode_routes_to_media_handler(self):
        """Mode 'image' routes to media_gen_handler, not text_gen_handler."""
        deps = _make_deps(_execute_step_response(
            "edited_image",
            [_image_chunk()],
        ))
        config = {"generation-mode": "image", "config$prompt": "a cat"}
        result = await dispatch_handler(
            "generate", {}, config, deps,
        )
        # Should have called execute_step on the backend.
        deps.backend.execute_step.assert_called_once()
        body = deps.backend.execute_step.call_args[0][0]
        assert body["planStep"]["modelApi"] == "ai_image_tool"

    @pytest.mark.asyncio
    async def test_audio_mode_routes_to_media_handler(self):
        deps = _make_deps(_execute_step_response(
            "generated_speech",
            [{"mimetype": "audio/wav", "data": "audio_data"}],
        ))
        config = {"generation-mode": "audio", "config$prompt": "Hello world"}
        result = await dispatch_handler(
            "generate", {}, config, deps,
        )
        deps.backend.execute_step.assert_called_once()
        body = deps.backend.execute_step.call_args[0][0]
        assert body["planStep"]["modelApi"] == "tts"

    @pytest.mark.asyncio
    async def test_text_mode_does_not_route_to_media_handler(self):
        """Text modes should still use text_gen_handler."""
        deps = _make_deps()
        # Provide a streaming response for the text handler.
        async def _stream(*a, **kw):
            yield {"candidates": [{"content": {"parts": [{"text": "hi"}]}}]}
        deps.backend.stream_generate_content = _stream
        config = {"generation-mode": "text-3-flash", "config$prompt": "hi"}
        result = await dispatch_handler(
            "generate", {}, config, deps,
        )
        # Should NOT have called execute_step.
        deps.backend.execute_step.assert_not_called()
        assert result["context"][0]["parts"][0]["text"] == "hi"


# ---------------------------------------------------------------------------
# media_gen_handler — prompt extraction
# ---------------------------------------------------------------------------

class TestMediaGenPrompt:
    """Test prompt extraction and template substitution."""

    @pytest.mark.asyncio
    async def test_prompt_from_config(self):
        """Prompt is extracted from config$prompt."""
        deps = _make_deps(_execute_step_response(
            "generated_music", [_text_chunk("music data")],
        ))
        config = {"config$prompt": "a peaceful melody"}
        result = await media_gen_handler(
            {}, config, deps, MEDIA_MODES["music"],
        )
        body = deps.backend.execute_step.call_args[0][0]
        prompt_data = body["execution_inputs"]["prompt"]["chunks"][0]["data"]
        assert base64.b64decode(prompt_data).decode() == "a peaceful melody"

    @pytest.mark.asyncio
    async def test_empty_prompt_returns_empty(self):
        """Empty prompt returns empty context."""
        deps = _make_deps()
        config = {}
        result = await media_gen_handler(
            {}, config, deps, MEDIA_MODES["music"],
        )
        assert result["context"][0]["parts"][0]["text"] == ""
        deps.backend.execute_step.assert_not_called()

    @pytest.mark.asyncio
    async def test_system_instruction_excluded_from_prompt(self):
        """System instruction should NOT be in the media prompt.

        The TS media generators don't include system instruction — it's
        only for Gemini text/agent modes. Including it causes TTS failures.
        """
        deps = _make_deps(_execute_step_response(
            "generated_speech", [_text_chunk("speech data")],
        ))
        config = {
            "config$prompt": "Hello world",
            "b-system-instruction": {
                "parts": [{"text": "Be helpful and creative"}],
            },
        }
        result = await media_gen_handler(
            {}, config, deps, MEDIA_MODES["audio"],
        )
        body = deps.backend.execute_step.call_args[0][0]
        prompt_data = body["execution_inputs"]["text_to_speak"]["chunks"][0]["data"]
        decoded = base64.b64decode(prompt_data).decode()
        assert "Hello world" in decoded
        assert "Be helpful" not in decoded

    @pytest.mark.asyncio
    async def test_prompt_with_upstream_context(self):
        """Upstream text context is included in the prompt."""
        deps = _make_deps(_execute_step_response(
            "generated_speech", [_text_chunk("speech data")],
        ))
        config = {"config$prompt": "Say this:"}
        inputs = {
            "context": [[
                {"role": "user", "parts": [{"text": "Hello world"}]},
            ]],
        }
        result = await media_gen_handler(
            inputs, config, deps, MEDIA_MODES["audio"],
        )
        body = deps.backend.execute_step.call_args[0][0]
        prompt_data = body["execution_inputs"]["text_to_speak"]["chunks"][0]["data"]
        decoded = base64.b64decode(prompt_data).decode()
        assert "Say this:" in decoded
        assert "Hello world" in decoded

    @pytest.mark.asyncio
    async def test_template_substitution(self):
        """Template placeholders are substituted with upstream values."""
        deps = _make_deps(_execute_step_response(
            "edited_image", [_image_chunk()],
        ))
        # Double braces: outer {} is template delimiter, inner {} is JSON.
        prompt = '{{"type":"in","path":"style","title":"style"}} landscape'
        config = {"config$prompt": prompt}
        inputs = {
            "p-z-style": [["watercolor"]],
        }
        result = await media_gen_handler(
            inputs, config, deps, MEDIA_MODES["image"],
        )
        body = deps.backend.execute_step.call_args[0][0]
        prompt_data = body["execution_inputs"]["input_instruction"]["chunks"][0]["data"]
        decoded = base64.b64decode(prompt_data).decode()
        assert "watercolor" in decoded
        assert "landscape" in decoded


# ---------------------------------------------------------------------------
# media_gen_handler — executeStep body
# ---------------------------------------------------------------------------

class TestMediaGenBody:
    """Test the executeStep request body construction."""

    @pytest.mark.asyncio
    async def test_image_body_structure(self):
        deps = _make_deps(_execute_step_response(
            "edited_image", [_image_chunk()],
        ))
        config = {
            "config$prompt": "a sunset",
            "p-aspect-ratio": "16:9",
            "p-model-name": "custom-model",
        }
        await media_gen_handler({}, config, deps, MEDIA_MODES["image"])
        body = deps.backend.execute_step.call_args[0][0]

        assert body["planStep"]["stepName"] == "EditImage"
        assert body["planStep"]["modelApi"] == "ai_image_tool"
        assert body["planStep"]["output"] == "edited_image"
        assert body["planStep"]["options"]["modelName"] == "custom-model"
        assert "input_instruction" in body["execution_inputs"]
        assert "aspect_ratio_key" in body["execution_inputs"]

    @pytest.mark.asyncio
    async def test_audio_body_includes_voice(self):
        deps = _make_deps(_execute_step_response(
            "generated_speech", [_text_chunk("audio")],
        ))
        config = {
            "config$prompt": "hello",
            "voice": "en-US-male",
        }
        await media_gen_handler({}, config, deps, MEDIA_MODES["audio"])
        body = deps.backend.execute_step.call_args[0][0]

        voice_data = body["execution_inputs"]["voice_key"]["chunks"][0]["data"]
        assert base64.b64decode(voice_data).decode() == "en-US-male"

    @pytest.mark.asyncio
    async def test_audio_default_voice(self):
        deps = _make_deps(_execute_step_response(
            "generated_speech", [_text_chunk("audio")],
        ))
        config = {"config$prompt": "hello"}
        await media_gen_handler({}, config, deps, MEDIA_MODES["audio"])
        body = deps.backend.execute_step.call_args[0][0]

        voice_data = body["execution_inputs"]["voice_key"]["chunks"][0]["data"]
        assert base64.b64decode(voice_data).decode() == "en-US-female"

    @pytest.mark.asyncio
    async def test_video_body_structure(self):
        deps = _make_deps(_execute_step_response(
            "generated_video",
            [{"mimetype": "video/mp4", "data": "video_data"}],
        ))
        config = {"config$prompt": "a cat walking"}
        await media_gen_handler({}, config, deps, MEDIA_MODES["video"])
        body = deps.backend.execute_step.call_args[0][0]

        assert body["planStep"]["stepName"] == "GenerateVideo"
        assert body["planStep"]["modelApi"] == "generate_video"
        assert body["planStep"]["output"] == "generated_video"
        assert "text_instruction" in body["execution_inputs"]
        assert "aspect_ratio_key" in body["execution_inputs"]

    @pytest.mark.asyncio
    async def test_music_body_no_extras(self):
        """Music mode should NOT have aspect_ratio or voice."""
        deps = _make_deps(_execute_step_response(
            "generated_music", [_text_chunk("music")],
        ))
        config = {"config$prompt": "jazz"}
        await media_gen_handler({}, config, deps, MEDIA_MODES["music"])
        body = deps.backend.execute_step.call_args[0][0]

        assert "aspect_ratio_key" not in body["execution_inputs"]
        assert "voice_key" not in body["execution_inputs"]
        assert body["planStep"]["modelApi"] == "generate_music"


# ---------------------------------------------------------------------------
# media_gen_handler — output parsing
# ---------------------------------------------------------------------------

class TestMediaGenOutput:
    """Test output parsing from executeStep response."""

    @pytest.mark.asyncio
    async def test_inline_image_output(self):
        """Inline image chunks are returned as LLMContent."""
        deps = _make_deps(_execute_step_response(
            "edited_image",
            [{"mimetype": "image/png", "data": "base64png"}],
        ))
        config = {"config$prompt": "a cat"}
        result = await media_gen_handler(
            {}, config, deps, MEDIA_MODES["image"],
        )
        context = result["context"]
        assert len(context) == 1
        part = context[0]["parts"][0]
        assert part["inlineData"]["mimeType"] == "image/png"
        assert part["inlineData"]["data"] == "base64png"

    @pytest.mark.asyncio
    async def test_stored_data_output(self):
        """StoredData chunks are returned with blob handles."""
        blob_id = "abc123-def456"
        deps = _make_deps(_execute_step_response(
            "edited_image",
            [{"mimetype": "image/png/storedData", "data": f"bucket/{blob_id}"}],
        ))
        config = {"config$prompt": "a cat"}
        result = await media_gen_handler(
            {}, config, deps, MEDIA_MODES["image"],
        )
        context = result["context"]
        assert len(context) == 1
        part = context[0]["parts"][0]
        assert part["storedData"]["handle"] == f"/board/blobs/{blob_id}"
        assert part["storedData"]["mimeType"] == "image/png"

    @pytest.mark.asyncio
    async def test_no_backend_stub_response(self):
        """Without a backend, returns a stub response."""
        deps = NodeHandlerDeps(
            on_agent_event=AsyncMock(),
            run_agent_fn=None,
            backend=None,
            interaction_store=None,
        )
        config = {"config$prompt": "a cat"}
        result = await media_gen_handler(
            {}, config, deps, MEDIA_MODES["image"],
        )
        assert result["context"][0]["parts"][0]["text"] == "[generated media]"


# ---------------------------------------------------------------------------
# Reference image collection
# ---------------------------------------------------------------------------

class TestReferenceImages:
    """Test reference image collection for i2i/i2v modes."""

    @pytest.mark.asyncio
    async def test_inline_image_from_upstream(self):
        """Inline images from upstream context are collected."""
        deps = _make_deps(_execute_step_response(
            "edited_image", [_image_chunk()],
        ))
        inputs = {
            "context": [[{
                "role": "user",
                "parts": [{"inlineData": {
                    "mimeType": "image/png",
                    "data": "upstream_img",
                }}],
            }]],
        }
        config = {"config$prompt": "edit this image"}
        await media_gen_handler(inputs, config, deps, MEDIA_MODES["image"])
        body = deps.backend.execute_step.call_args[0][0]

        assert "input_image" in body["execution_inputs"]
        chunks = body["execution_inputs"]["input_image"]["chunks"]
        assert len(chunks) == 1
        assert chunks[0]["data"] == "upstream_img"

    @pytest.mark.asyncio
    async def test_text_parts_not_collected_as_images(self):
        """Text parts from upstream should not be collected as images."""
        deps = _make_deps(_execute_step_response(
            "edited_image", [_image_chunk()],
        ))
        inputs = {
            "context": [[{
                "role": "user",
                "parts": [{"text": "just text"}],
            }]],
        }
        config = {"config$prompt": "create image"}
        await media_gen_handler(inputs, config, deps, MEDIA_MODES["image"])
        body = deps.backend.execute_step.call_args[0][0]

        # No reference images should be collected.
        assert "input_image" not in body["execution_inputs"]

    @pytest.mark.asyncio
    async def test_video_reference_image_key(self):
        """Video mode uses 'reference_image' not 'input_image'."""
        deps = _make_deps(_execute_step_response(
            "generated_video",
            [{"mimetype": "video/mp4", "data": "video_data"}],
        ))
        inputs = {
            "context": [[{
                "role": "user",
                "parts": [{"inlineData": {
                    "mimeType": "image/jpeg",
                    "data": "ref_img",
                }}],
            }]],
        }
        config = {"config$prompt": "animate this"}
        await media_gen_handler(inputs, config, deps, MEDIA_MODES["video"])
        body = deps.backend.execute_step.call_args[0][0]

        assert "reference_image" in body["execution_inputs"]
        assert "input_image" not in body["execution_inputs"]

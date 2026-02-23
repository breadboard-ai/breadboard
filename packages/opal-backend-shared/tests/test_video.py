# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for functions/video.py — generate_video function and expand_veo_error.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.functions.video import (
    get_video_function_group,
    _define_generate_video,
    expand_veo_error,
    GENERATE_VIDEO_FUNCTION,
    VIDEO_MODEL_NAME,
    SUPPORT_CODES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop_status(_msg):
    """No-op status callback."""
    pass


def _make_execute_step_result(mime_type="video/mp4"):
    """Build a mock execute_step result with a single video chunk."""
    return {
        "chunks": [
            {
                "parts": [
                    {
                        "storedData": {
                            "handle": "gcs://bucket/video.mp4",
                            "mimeType": mime_type,
                        }
                    }
                ],
                "role": "user",
            }
        ]
    }


# ---------------------------------------------------------------------------
# Function group
# ---------------------------------------------------------------------------


class TestGetVideoFunctionGroup:
    def test_returns_function_group(self):
        fs = AgentFileSystem()
        group = get_video_function_group(file_system=fs)
        assert group.instruction is not None
        assert GENERATE_VIDEO_FUNCTION in group.instruction

    def test_has_declaration(self):
        fs = AgentFileSystem()
        group = get_video_function_group(file_system=fs)
        names = [d["name"] for d in group.declarations]
        assert GENERATE_VIDEO_FUNCTION in names

    def test_has_definition(self):
        fs = AgentFileSystem()
        group = get_video_function_group(file_system=fs)
        defn_names = [name for name, _ in group.definitions]
        assert GENERATE_VIDEO_FUNCTION in defn_names


# ---------------------------------------------------------------------------
# generate_video handler
# ---------------------------------------------------------------------------


class TestGenerateVideoHandler:
    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_basic_video_generation(self, mock_execute):
        """Handler generates a video and saves to FS."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {"prompt": "Waves crashing on a beach"},
            _noop_status,
        )
        assert "video" in result
        assert result["video"].startswith("/mnt/")
        mock_execute.assert_called_once()

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_uses_hardcoded_model(self, mock_execute):
        """Model is hardcoded to VIDEO_MODEL_NAME."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        await defn.handler(
            {"prompt": "A sunset"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert body["planStep"]["options"]["modelName"] == VIDEO_MODEL_NAME

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_aspect_ratio_passed(self, mock_execute):
        """Aspect ratio is encoded in execution_inputs."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        await defn.handler(
            {"prompt": "A sunset", "aspect_ratio": "9:16"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        import base64
        ar_data = body["execution_inputs"]["aspect_ratio_key"]["chunks"][0]["data"]
        assert base64.b64decode(ar_data).decode() == "9:16"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_invalid_aspect_ratio_defaults(self, mock_execute):
        """Invalid aspect ratio falls back to 16:9."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        await defn.handler(
            {"prompt": "A sunset", "aspect_ratio": "4:3"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        import base64
        ar_data = body["execution_inputs"]["aspect_ratio_key"]["chunks"][0]["data"]
        assert base64.b64decode(ar_data).decode() == "16:9"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    @patch("opal_backend_shared.functions.video.resolve_part_to_chunk")
    async def test_with_reference_images(self, mock_resolve, mock_execute):
        """Reference images are resolved and added as reference_image."""
        mock_resolve.return_value = {
            "mimetype": "image/png",
            "data": "inputimg",
        }
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        fs.add_part(
            {"inlineData": {"data": "base64data", "mimeType": "image/png"}}
        )

        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {
                "prompt": "Animate this image",
                "images": ["/mnt/image1.png"],
            },
            _noop_status,
        )
        assert "video" in result
        mock_resolve.assert_called_once()

        # Verify reference_image was added to execution_inputs
        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert "reference_image" in body["execution_inputs"]
        assert "reference_image" in body["planStep"]["inputParameters"]

    @pytest.mark.asyncio
    async def test_missing_reference_image(self):
        """Missing reference image path → error."""
        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {
                "prompt": "Animate this",
                "images": ["/mnt/nonexistent.png"],
            },
            _noop_status,
        )
        assert "error" in result
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_execute_step_error(self, mock_execute):
        """executeStep error → returned as error."""
        mock_execute.side_effect = ValueError("Model quota exceeded")

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {"prompt": "A cat"},
            _noop_status,
        )
        assert "error" in result
        assert "quota" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_execute_step_safety_error(self, mock_execute):
        """executeStep safety error → expanded with metadata."""
        mock_execute.side_effect = ValueError(
            "Video blocked. Support codes: 58061214, 90789179"
        )

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {"prompt": "Inappropriate content"},
            _noop_status,
        )
        assert "error" in result
        assert "metadata" in result
        assert result["metadata"]["kind"] == "safety"
        assert "child" in result["metadata"]["reasons"]
        assert "sexual" in result["metadata"]["reasons"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_empty_result(self, mock_execute):
        """Empty executeStep result → error."""
        mock_execute.return_value = {"chunks": []}

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {"prompt": "A sunset"},
            _noop_status,
        )
        assert "error" in result
        assert "No video" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_status_callback(self, mock_execute):
        """Status callback is called and cleared."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        statuses = []
        def track(msg):
            statuses.append(msg)

        await defn.handler(
            {"prompt": "A sunset"},
            track,
        )
        assert statuses[0] == "Generating Video"
        assert statuses[-1] is None

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_no_reference_images(self, mock_execute):
        """No reference images → no reference_image in execution_inputs."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        await defn.handler(
            {"prompt": "A sunset"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert "reference_image" not in body["execution_inputs"]
        assert body["planStep"]["inputParameters"] == ["text_instruction"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_model_api_is_generate_video(self, mock_execute):
        """The modelApi field is 'generate_video'."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        await defn.handler(
            {"prompt": "A sunset"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert body["planStep"]["modelApi"] == "generate_video"
        assert body["planStep"]["stepName"] == "GenerateVideo"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_empty_parts_in_chunk(self, mock_execute):
        """Output chunk with no parts → error."""
        mock_execute.return_value = {
            "chunks": [{"parts": [], "role": "user"}]
        }

        fs = AgentFileSystem()
        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {"prompt": "A sunset"},
            _noop_status,
        )
        assert "error" in result
        assert "No video" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.resolve_part_to_chunk")
    async def test_resolve_part_to_chunk_error(self, mock_resolve):
        """resolve_part_to_chunk raises → error returned."""
        mock_resolve.side_effect = ValueError("Unsupported part format")

        fs = AgentFileSystem()
        fs.add_part(
            {"inlineData": {"data": "base64data", "mimeType": "image/png"}}
        )

        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {
                "prompt": "Animate this",
                "images": ["/mnt/image1.png"],
            },
            _noop_status,
        )
        assert "error" in result
        assert "Unsupported part format" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.video.execute_step")
    async def test_add_part_error(self, mock_execute):
        """add_part returning $error → error returned."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        # Monkey-patch add_part to simulate an error
        fs.add_part = lambda part, name=None: {"$error": "FS write failed"}

        defn = _define_generate_video(file_system=fs)

        result = await defn.handler(
            {"prompt": "A sunset"},
            _noop_status,
        )
        assert "error" in result
        assert "FS write failed" in result["error"]


# ---------------------------------------------------------------------------
# expand_veo_error
# ---------------------------------------------------------------------------


class TestExpandVeoError:
    def test_known_support_code(self):
        """Known support code → safety metadata."""
        result = expand_veo_error(
            "Blocked. Support codes: 58061214",
            "veo-3.0-generate-preview",
        )
        assert "metadata" in result
        assert result["metadata"]["kind"] == "safety"
        assert "child" in result["metadata"]["reasons"]
        assert result["metadata"]["model"] == "veo-3.0-generate-preview"

    def test_multiple_support_codes(self):
        """Multiple support codes → multiple reasons."""
        result = expand_veo_error(
            "Blocked. Support codes: 58061214, 90789179, 61493863",
            "veo-2.0-generate-001",
        )
        assert "metadata" in result
        reasons = result["metadata"]["reasons"]
        assert "child" in reasons
        assert "sexual" in reasons
        assert "violence" in reasons

    def test_unknown_support_code(self):
        """Unknown support code → 'other' reason."""
        result = expand_veo_error(
            "Blocked. Support codes: 99999999",
            "veo-3.0-generate-preview",
        )
        assert "metadata" in result
        assert "other" in result["metadata"]["reasons"]

    def test_no_support_codes(self):
        """No support codes → plain error, no metadata."""
        result = expand_veo_error(
            "Generic error message",
            "veo-3.0-generate-preview",
        )
        assert result == {"error": "Generic error message"}
        assert "metadata" not in result

    def test_error_preserved(self):
        """Original error message is preserved."""
        msg = "Content policy violation. Support codes: 64151117"
        result = expand_veo_error(msg, "veo-3.0-generate-preview")
        assert result["error"] == msg

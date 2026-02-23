# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for functions/image.py — generate_images function.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.functions.image import (
    get_image_function_group,
    _define_generate_images,
    GENERATE_IMAGES_FUNCTION,
    IMAGE_PRO_MODEL_NAME,
    IMAGE_FLASH_MODEL_NAME,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop_status(_msg):
    """No-op status callback."""
    pass


def _make_execute_step_result(num_images=1, mime_type="image/png"):
    """Build a mock execute_step result with inline data chunks."""
    return {
        "chunks": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": f"imgdata{i}",
                        }
                    }
                ],
                "role": "user",
            }
            for i in range(num_images)
        ]
    }


# ---------------------------------------------------------------------------
# Function group
# ---------------------------------------------------------------------------


class TestGetImageFunctionGroup:
    def test_returns_function_group(self):
        fs = AgentFileSystem()
        group = get_image_function_group(file_system=fs)
        assert group.instruction is not None
        assert GENERATE_IMAGES_FUNCTION in group.instruction

    def test_has_declaration(self):
        fs = AgentFileSystem()
        group = get_image_function_group(file_system=fs)
        names = [d["name"] for d in group.declarations]
        assert GENERATE_IMAGES_FUNCTION in names

    def test_has_definition(self):
        fs = AgentFileSystem()
        group = get_image_function_group(file_system=fs)
        defn_names = [name for name, _ in group.definitions]
        assert GENERATE_IMAGES_FUNCTION in defn_names


# ---------------------------------------------------------------------------
# generate_images handler
# ---------------------------------------------------------------------------


class TestGenerateImagesHandler:
    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_basic_image_generation(self, mock_execute):
        """Handler generates an image and saves to FS."""
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        result = await defn.handler(
            {"prompt": "A cat", "model": "flash"},
            _noop_status,
        )
        assert "images" in result
        assert len(result["images"]) == 1
        assert result["images"][0].startswith("/mnt/")
        mock_execute.assert_called_once()

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_multiple_images(self, mock_execute):
        """Handler saves multiple output images."""
        mock_execute.return_value = _make_execute_step_result(3)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        result = await defn.handler(
            {"prompt": "Three cats", "model": "flash"},
            _noop_status,
        )
        assert len(result["images"]) == 3

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_pro_model_selection(self, mock_execute):
        """Pro model uses IMAGE_PRO_MODEL_NAME."""
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        await defn.handler(
            {"prompt": "A logo", "model": "pro"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert body["planStep"]["options"]["modelName"] == IMAGE_PRO_MODEL_NAME

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_flash_model_selection(self, mock_execute):
        """Flash model uses IMAGE_FLASH_MODEL_NAME."""
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        await defn.handler(
            {"prompt": "Quick sketch", "model": "flash"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert body["planStep"]["options"]["modelName"] == IMAGE_FLASH_MODEL_NAME

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_aspect_ratio_passed(self, mock_execute):
        """Aspect ratio is encoded in execution_inputs."""
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        await defn.handler(
            {"prompt": "Wide image", "model": "flash", "aspect_ratio": "16:9"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        import base64
        ar_data = body["execution_inputs"]["aspect_ratio_key"]["chunks"][0]["data"]
        assert base64.b64decode(ar_data).decode() == "16:9"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    @patch("opal_backend_shared.functions.image.resolve_part_to_chunk")
    async def test_with_input_images(self, mock_resolve, mock_execute):
        """Input images are resolved and added to execution_inputs."""
        mock_resolve.return_value = {
            "mimetype": "image/png",
            "data": "inputimg",
        }
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        # Add an image to the FS
        fs.add_part(
            {"inlineData": {"data": "base64data", "mimeType": "image/png"}}
        )

        defn = _define_generate_images(file_system=fs)

        result = await defn.handler(
            {
                "prompt": "Edit this",
                "model": "flash",
                "images": ["/mnt/image1.png"],
            },
            _noop_status,
        )
        assert "images" in result
        mock_resolve.assert_called_once()

        # Verify input_image was added to execution_inputs
        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert "input_image" in body["execution_inputs"]
        assert "input_image" in body["planStep"]["inputParameters"]

    @pytest.mark.asyncio
    async def test_missing_input_image(self):
        """Missing input image path → error."""
        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        result = await defn.handler(
            {
                "prompt": "Edit this",
                "model": "flash",
                "images": ["/mnt/nonexistent.png"],
            },
            _noop_status,
        )
        assert "error" in result
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_execute_step_error(self, mock_execute):
        """executeStep error → returned as error."""
        mock_execute.side_effect = ValueError("Model quota exceeded")

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        result = await defn.handler(
            {"prompt": "A cat", "model": "flash"},
            _noop_status,
        )
        assert "error" in result
        assert "quota" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_empty_result(self, mock_execute):
        """Empty executeStep result → error."""
        mock_execute.return_value = {"chunks": []}

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        result = await defn.handler(
            {"prompt": "A cat", "model": "flash"},
            _noop_status,
        )
        assert "error" in result
        assert "No images" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_status_callback(self, mock_execute):
        """Status callback is called and cleared."""
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        statuses = []
        def track(msg):
            statuses.append(msg)

        await defn.handler(
            {"prompt": "A cat", "model": "flash"},
            track,
        )
        assert statuses[0] == "Generating Image(s)"
        assert statuses[-1] is None

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_custom_file_name(self, mock_execute):
        """Custom file name is used for saved images."""
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        result = await defn.handler(
            {"prompt": "A cat", "model": "flash", "file_name": "my_cat"},
            _noop_status,
        )
        assert "images" in result
        # The file name should contain "my_cat"
        assert "my_cat" in result["images"][0]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.image.execute_step")
    async def test_no_grounding_tools(self, mock_execute):
        """No input images → no input_image in execution_inputs."""
        mock_execute.return_value = _make_execute_step_result(1)

        fs = AgentFileSystem()
        defn = _define_generate_images(file_system=fs)

        await defn.handler(
            {"prompt": "A cat", "model": "flash"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert "input_image" not in body["execution_inputs"]
        assert body["planStep"]["inputParameters"] == ["input_instruction"]

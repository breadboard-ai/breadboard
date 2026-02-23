# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""
Tests for functions/audio.py — speech and music generation functions.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from opal_backend_shared.agent_file_system import AgentFileSystem
from opal_backend_shared.functions.audio import (
    get_audio_function_group,
    _define_generate_speech,
    _define_generate_music,
    GENERATE_SPEECH_FUNCTION,
    GENERATE_MUSIC_FUNCTION,
    VOICE_MAP,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _noop_status(_msg):
    """No-op status callback."""
    pass


def _make_execute_step_result(mime_type="audio/mp3"):
    """Build a mock execute_step result with a single audio chunk."""
    return {
        "chunks": [
            {
                "parts": [
                    {
                        "storedData": {
                            "handle": "gcs://bucket/audio.mp3",
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


class TestGetAudioFunctionGroup:
    def test_returns_function_group(self):
        fs = AgentFileSystem()
        group = get_audio_function_group(file_system=fs)
        assert group.instruction is not None
        # TS has no extra instruction for audio functions
        assert group.instruction == ""

    def test_has_both_declarations(self):
        fs = AgentFileSystem()
        group = get_audio_function_group(file_system=fs)
        names = [d["name"] for d in group.declarations]
        assert GENERATE_SPEECH_FUNCTION in names
        assert GENERATE_MUSIC_FUNCTION in names

    def test_has_both_definitions(self):
        fs = AgentFileSystem()
        group = get_audio_function_group(file_system=fs)
        defn_names = [name for name, _ in group.definitions]
        assert GENERATE_SPEECH_FUNCTION in defn_names
        assert GENERATE_MUSIC_FUNCTION in defn_names


# ---------------------------------------------------------------------------
# generate_speech_from_text handler
# ---------------------------------------------------------------------------


class TestGenerateSpeechHandler:
    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_basic_speech_generation(self, mock_execute):
        """Handler generates speech and saves to FS."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        result = await defn.handler(
            {"text": "Hello world"},
            _noop_status,
        )
        assert "speech" in result
        assert result["speech"].startswith("/mnt/")
        mock_execute.assert_called_once()

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_default_voice(self, mock_execute):
        """Default voice is Female (English) → en-US-female."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        await defn.handler(
            {"text": "Hello"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        import base64
        voice_data = body["execution_inputs"]["voice_key"]["chunks"][0]["data"]
        assert base64.b64decode(voice_data).decode() == "en-US-female"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_male_voice(self, mock_execute):
        """Male (English) → en-US-male."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        await defn.handler(
            {"text": "Hello", "voice": "Male (English)"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        import base64
        voice_data = body["execution_inputs"]["voice_key"]["chunks"][0]["data"]
        assert base64.b64decode(voice_data).decode() == "en-US-male"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_unknown_voice_defaults(self, mock_execute):
        """Unknown voice falls back to en-US-female."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        await defn.handler(
            {"text": "Hello", "voice": "Unknown Voice"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        import base64
        voice_data = body["execution_inputs"]["voice_key"]["chunks"][0]["data"]
        assert base64.b64decode(voice_data).decode() == "en-US-female"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_step_api_fields(self, mock_execute):
        """executeStep body has correct API fields."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        await defn.handler(
            {"text": "Hello"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert body["planStep"]["stepName"] == "GenerateAudio"
        assert body["planStep"]["modelApi"] == "tts"
        assert body["planStep"]["output"] == "generated_speech"
        assert body["planStep"]["inputParameters"] == ["text_to_speak"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_status_callback(self, mock_execute):
        """Status callback is called and cleared."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        statuses = []
        await defn.handler({"text": "Hello"}, statuses.append)
        assert statuses[0] == "Generating Speech"
        assert statuses[-1] is None

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_execute_step_error(self, mock_execute):
        """executeStep error → returned as error."""
        mock_execute.side_effect = ValueError("TTS quota exceeded")

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        result = await defn.handler({"text": "Hello"}, _noop_status)
        assert "error" in result
        assert "quota" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_empty_result(self, mock_execute):
        """Empty executeStep result → error."""
        mock_execute.return_value = {"chunks": []}

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        result = await defn.handler({"text": "Hello"}, _noop_status)
        assert "error" in result
        assert "No speech" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_empty_parts(self, mock_execute):
        """Output chunk with no parts → error."""
        mock_execute.return_value = {"chunks": [{"parts": [], "role": "user"}]}

        fs = AgentFileSystem()
        defn = _define_generate_speech(file_system=fs)

        result = await defn.handler({"text": "Hello"}, _noop_status)
        assert "error" in result
        assert "No speech" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_add_part_error(self, mock_execute):
        """add_part returning $error → error returned."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        fs.add_part = lambda part, name=None: {"$error": "FS write failed"}

        defn = _define_generate_speech(file_system=fs)

        result = await defn.handler({"text": "Hello"}, _noop_status)
        assert "error" in result
        assert "FS write failed" in result["error"]


# ---------------------------------------------------------------------------
# generate_music_from_text handler
# ---------------------------------------------------------------------------


class TestGenerateMusicHandler:
    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_basic_music_generation(self, mock_execute):
        """Handler generates music and saves to FS."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_music(file_system=fs)

        result = await defn.handler(
            {"prompt": "Upbeat electronic dance music"},
            _noop_status,
        )
        assert "music" in result
        assert result["music"].startswith("/mnt/")
        mock_execute.assert_called_once()

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_step_api_fields(self, mock_execute):
        """executeStep body has correct API fields."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_music(file_system=fs)

        await defn.handler(
            {"prompt": "Jazz piano"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        assert body["planStep"]["stepName"] == "GenerateMusic"
        assert body["planStep"]["modelApi"] == "generate_music"
        assert body["planStep"]["output"] == "generated_music"
        assert body["planStep"]["inputParameters"] == ["prompt"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_prompt_encoded(self, mock_execute):
        """Prompt is base64-encoded in execution_inputs."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_music(file_system=fs)

        await defn.handler(
            {"prompt": "Jazz piano"},
            _noop_status,
        )

        call_kwargs = mock_execute.call_args
        body = call_kwargs.args[0]
        import base64
        prompt_data = body["execution_inputs"]["prompt"]["chunks"][0]["data"]
        assert base64.b64decode(prompt_data).decode() == "Jazz piano"

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_status_callback(self, mock_execute):
        """Status callback is called and cleared."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        defn = _define_generate_music(file_system=fs)

        statuses = []
        await defn.handler({"prompt": "Jazz piano"}, statuses.append)
        assert statuses[0] == "Generating Music"
        assert statuses[-1] is None

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_execute_step_error(self, mock_execute):
        """executeStep error → returned as error."""
        mock_execute.side_effect = ValueError("Music quota exceeded")

        fs = AgentFileSystem()
        defn = _define_generate_music(file_system=fs)

        result = await defn.handler({"prompt": "Jazz"}, _noop_status)
        assert "error" in result
        assert "quota" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_empty_result(self, mock_execute):
        """Empty executeStep result → error."""
        mock_execute.return_value = {"chunks": []}

        fs = AgentFileSystem()
        defn = _define_generate_music(file_system=fs)

        result = await defn.handler({"prompt": "Jazz"}, _noop_status)
        assert "error" in result
        assert "No music" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_empty_parts(self, mock_execute):
        """Output chunk with no parts → error."""
        mock_execute.return_value = {"chunks": [{"parts": [], "role": "user"}]}

        fs = AgentFileSystem()
        defn = _define_generate_music(file_system=fs)

        result = await defn.handler({"prompt": "Jazz"}, _noop_status)
        assert "error" in result
        assert "No music" in result["error"]

    @pytest.mark.asyncio
    @patch("opal_backend_shared.functions.audio.execute_step")
    async def test_add_part_error(self, mock_execute):
        """add_part returning $error → error returned."""
        mock_execute.return_value = _make_execute_step_result()

        fs = AgentFileSystem()
        fs.add_part = lambda part, name=None: {"$error": "FS write failed"}

        defn = _define_generate_music(file_system=fs)

        result = await defn.handler({"prompt": "Jazz"}, _noop_status)
        assert "error" in result
        assert "FS write failed" in result["error"]

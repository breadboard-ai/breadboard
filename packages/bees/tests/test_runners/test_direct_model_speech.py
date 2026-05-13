# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import asyncio
import base64
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from bees.disk_file_system import DiskFileSystem
from bees.protocols.session import SessionConfiguration
from bees.runners.direct_model import DirectModelRunner


class TestDirectModelSpeechAdapter(unittest.TestCase):
    """Test SpeechAdapter execution, REST API payloads, voice preset mappings, and MP3 file outputs."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.mkdtemp()
        self.ticket_dir = Path(self.tmp_dir)
        self.fs_dir = self.ticket_dir / "filesystem"
        self.fs_dir.mkdir(parents=True, exist_ok=True)
        self.file_system = DiskFileSystem(self.fs_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp_dir)

    def test_execute_speech_adapter_default_success(self):
        # Prepare ticket metadata with slug and speech tag
        metadata = {
            "slug": "audio_memo",
            "tags": ["speech"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("Hello world from speech synthesis", encoding="utf-8")

        config = SessionConfiguration(
            ticket_id="test-speech-task",
            ticket_dir=self.ticket_dir,
            file_system=self.file_system,
            segments=[],
            function_groups=[],
            function_filter=[],
            model="gemini-3.1-flash-tts-preview"
        )

        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client_instance

            dummy_mp3_bytes = b"ID3dummy-mp3-audio-content"
            dummy_base64 = base64.b64encode(dummy_mp3_bytes).decode("ascii")

            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.text = ""
            mock_res.json.return_value = {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "inlineData": {
                                        "mimeType": "audio/wav",
                                        "data": dummy_base64
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
            mock_client_instance.post = AsyncMock(return_value=mock_res)

            runner = DirectModelRunner(mock_backend, api_key="fake-api-key")

            async def run_stream():
                stream = await runner.run(config)
                events = []
                async for event in stream:
                    events.append(event)
                return events

            events = asyncio.run(run_stream())

            # 1. Verify httpx API call URL and payload structure
            mock_client_instance.post.assert_called_once()
            called_url = mock_client_instance.post.call_args[0][0]
            called_kwargs = mock_client_instance.post.call_args[1]
            self.assertEqual(
                called_url,
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=fake-api-key"
            )
            
            called_json = called_kwargs["json"]
            self.assertEqual(
                called_json["contents"][0]["parts"][0]["text"],
                "Hello world from speech synthesis"
            )
            
            # Verify default voice config maps to 'Kore'
            speech_config = called_json["generationConfig"]["speechConfig"]
            self.assertEqual(
                speech_config["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"],
                "Kore"
            )
            self.assertEqual(called_json["generationConfig"]["responseModalities"], ["AUDIO"])

            # 2. Verify streaming events
            self.assertEqual(len(events), 2)
            self.assertTrue("sendRequest" in events[0])
            self.assertTrue("complete" in events[1])
            self.assertTrue(events[1]["complete"]["result"]["success"])
            self.assertEqual(len(events[1]["complete"]["result"]["intermediate"]), 1)

            # 3. Verify file generation under sandboxed slug directory
            output_file = self.fs_dir / "audio_memo" / "audio_0.wav"
            self.assertTrue(output_file.is_file())
            self.assertEqual(output_file.read_bytes(), dummy_mp3_bytes)

    def test_execute_speech_adapter_custom_voice_preset(self):
        # Test mapping custom male preset to 'Puck' via segments config
        metadata = {
            "slug": "podcast",
            "tags": ["speech"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("Welcome to the daily tech dig", encoding="utf-8")

        config = SessionConfiguration(
            ticket_id="test-speech-custom-task",
            ticket_dir=self.ticket_dir,
            file_system=self.file_system,
            segments=[{"type": "voice", "voice": "male"}],
            function_groups=[],
            function_filter=[],
            model="gemini-3.1-flash-tts-preview"
        )

        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client_instance

            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.json.return_value = {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "inlineData": {
                                        "mimeType": "audio/wav",
                                        "data": base64.b64encode(b"custom-bytes").decode("ascii")
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
            mock_client_instance.post = AsyncMock(return_value=mock_res)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")

            async def run_stream():
                stream = await runner.run(config)
                events = []
                async for event in stream:
                    events.append(event)
                return events

            events = asyncio.run(run_stream())

            mock_client_instance.post.assert_called_once()
            called_json = mock_client_instance.post.call_args[1]["json"]
            
            # Verify mapped voice config resolves to 'Puck'
            speech_config = called_json["generationConfig"]["speechConfig"]
            self.assertEqual(
                speech_config["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"],
                "Puck"
            )
            
            output_file = self.fs_dir / "podcast" / "audio_0.wav"
            self.assertTrue(output_file.is_file())
            self.assertTrue(output_file.read_bytes().startswith(b"RIFF"))
            self.assertTrue(output_file.read_bytes().endswith(b"custom-bytes"))


if __name__ == "__main__":
    unittest.main()

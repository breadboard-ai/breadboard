# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import asyncio
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from bees.disk_file_system import DiskFileSystem
from bees.protocols.session import SessionConfiguration
from bees.runners.direct_model import DirectModelRunner


class TestDirectModelVideoAdapter(unittest.TestCase):
    """Test VideoAdapter execution, REST payloads, polling, safety expansion, and MP4 outputs."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.mkdtemp()
        self.ticket_dir = Path(self.tmp_dir)
        self.fs_dir = self.ticket_dir / "filesystem"
        self.fs_dir.mkdir(parents=True, exist_ok=True)
        self.file_system = DiskFileSystem(self.fs_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp_dir)

    def test_execute_video_adapter_success(self):
        metadata = {
            "slug": "intro",
            "tags": ["video"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("Cinematic view of a forest", encoding="utf-8")

        config = SessionConfiguration(
            ticket_id="test-video-task",
            ticket_dir=self.ticket_dir,
            file_system=self.file_system,
            segments=[{"type": "aspect_ratio", "aspect_ratio": "9:16"}],
            function_groups=[],
            function_filter=[],
            model="veo-3.1-generate-preview"
        )

        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client_instance

            # 1. POST response for predictLongRunning
            mock_post_res = MagicMock()
            mock_post_res.status_code = 200
            mock_post_res.json.return_value = {"name": "operations/veo-op-123"}
            mock_client_instance.post = AsyncMock(return_value=mock_post_res)

            # 2. GET responses for polling and video download
            mock_poll_res = MagicMock()
            mock_poll_res.status_code = 200
            mock_poll_res.json.return_value = {
                "done": True,
                "response": {
                    "generateVideoResponse": {
                        "generatedSamples": [
                            {
                                "video": {
                                    "uri": "https://fake-video-download-uri"
                                }
                            }
                        ]
                    }
                }
            }

            mock_video_res = MagicMock()
            mock_video_res.status_code = 200
            mock_video_res.content = b"dummy-mp4-video-content"

            async def side_effect_get(url, **kwargs):
                if "operations/veo-op-123" in url:
                    return mock_poll_res
                return mock_video_res

            mock_client_instance.get = AsyncMock(side_effect=side_effect_get)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")

            async def run_stream():
                stream = await runner.run(config)
                events = []
                async for event in stream:
                    events.append(event)
                return events

            events = asyncio.run(run_stream())

            # Verify POST API parameters
            mock_client_instance.post.assert_called_once()
            called_url = mock_client_instance.post.call_args[0][0]
            called_json = mock_client_instance.post.call_args[1]["json"]
            self.assertEqual(
                called_url,
                "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=fake-key"
            )
            self.assertEqual(called_json["instances"][0]["prompt"], "Cinematic view of a forest")
            self.assertEqual(called_json["parameters"]["aspectRatio"], "9:16")

            # Verify streaming events
            self.assertEqual(len(events), 4)
            self.assertTrue("sendRequest" in events[0])
            self.assertTrue("systemMessage" in events[1])
            self.assertTrue("systemMessage" in events[2])
            self.assertTrue("complete" in events[3])
            self.assertTrue(events[3]["complete"]["result"]["success"])

            # Verify GET API parameters for polling and download
            self.assertEqual(mock_client_instance.get.call_count, 2)
            download_call_args = mock_client_instance.get.call_args_list[1]
            self.assertEqual(download_call_args[0][0], "https://fake-video-download-uri")
            self.assertEqual(download_call_args[1]["headers"]["x-goog-api-key"], "fake-key")

            # Verify MP4 file output
            output_file = self.fs_dir / "intro" / "video_0.mp4"
            self.assertTrue(output_file.is_file())
            self.assertEqual(output_file.read_bytes(), b"dummy-mp4-video-content")

    def test_execute_video_adapter_safety_error(self):
        metadata = {
            "slug": "intro",
            "tags": ["video"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("Unsafe video prompt", encoding="utf-8")

        config = SessionConfiguration(
            ticket_id="test-video-safety-task",
            ticket_dir=self.ticket_dir,
            file_system=self.file_system,
            segments=[],
            function_groups=[],
            function_filter=[],
            model="veo-3.1-generate-preview"
        )

        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client_instance

            mock_post_res = MagicMock()
            mock_post_res.status_code = 400
            mock_post_res.text = "Request rejected. Support codes: 29310472"
            mock_client_instance.post = AsyncMock(return_value=mock_post_res)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")

            async def run_stream():
                stream = await runner.run(config)
                events = []
                async for event in stream:
                    events.append(event)
                return events

            events = asyncio.run(run_stream())

            # Expecting sendRequest and error event
            self.assertEqual(len(events), 2)
            self.assertTrue("error" in events[1])
            err_obj = events[1]["error"]
            self.assertTrue("metadata" in err_obj)
            self.assertEqual(err_obj["metadata"]["kind"], "safety")
            self.assertIn("celebrity", err_obj["metadata"]["reasons"])

    def test_execute_video_adapter_resilient_polling(self):
        metadata = {
            "slug": "intro",
            "tags": ["video"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("Cinematic view of a forest", encoding="utf-8")
        
        # Pre-seed sidecar file to simulate resuming polling after server restart
        state_file = self.ticket_dir / "polling_state.json"
        state_file.write_text(json.dumps({"operation_name": "operations/veo-op-resumed"}), encoding="utf-8")

        config = SessionConfiguration(
            ticket_id="test-video-resume-task",
            ticket_dir=self.ticket_dir,
            file_system=self.file_system,
            segments=[],
            function_groups=[],
            function_filter=[],
            model="veo-3.1-generate-preview"
        )

        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client_instance

            # First attempt to poll fails (404 expired) to trigger self-healing fallback
            mock_poll_fail = MagicMock()
            mock_poll_fail.status_code = 404
            mock_poll_fail.text = "Operation not found"

            # Fallback fresh generation POST succeeds
            mock_post_res = MagicMock()
            mock_post_res.status_code = 200
            mock_post_res.json.return_value = {"name": "operations/veo-op-fallback"}
            mock_client_instance.post = AsyncMock(return_value=mock_post_res)

            # Fallback polling succeeds
            mock_poll_ok = MagicMock()
            mock_poll_ok.status_code = 200
            mock_poll_ok.json.return_value = {
                "done": True,
                "response": {
                    "generateVideoResponse": {
                        "generatedSamples": [{"video": {"uri": "https://fake-fallback-uri"}}]
                    }
                }
            }

            mock_video_res = MagicMock()
            mock_video_res.status_code = 200
            mock_video_res.content = b"fallback-mp4-bytes"

            async def side_effect_get(url, **kwargs):
                if "operations/veo-op-resumed" in url:
                    return mock_poll_fail
                if "operations/veo-op-fallback" in url:
                    return mock_poll_ok
                return mock_video_res

            mock_client_instance.get = AsyncMock(side_effect=side_effect_get)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")

            async def run_stream():
                stream = await runner.run(config)
                events = []
                async for event in stream:
                    events.append(event)
                return events

            events = asyncio.run(run_stream())

            # Verify fallback sequence
            # 1. sendRequest
            # 2. systemMessage: Resuming polling
            # 3. systemMessage: Polling operation...
            # 4. systemMessage: Polling unrecoverable
            # 5. systemMessage: Initiated polling
            # 6. systemMessage: Polling operation...
            # 7. complete
            self.assertEqual(len(events), 7)
            mock_client_instance.post.assert_called_once()
            self.assertEqual(mock_client_instance.get.call_count, 3)
            
            # Sidecar file should be unlinked
            self.assertFalse(state_file.exists())
            
            # Verify final delivery
            output_file = self.fs_dir / "intro" / "video_0.mp4"
            self.assertTrue(output_file.is_file())
            self.assertEqual(output_file.read_bytes(), b"fallback-mp4-bytes")


if __name__ == "__main__":
    unittest.main()

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


def _make_config(
    ticket_dir: Path,
    file_system: DiskFileSystem,
    *,
    segments: list | None = None,
    model: str = "veo-3.1-generate-preview",
    ticket_id: str = "test-video-task",
) -> SessionConfiguration:
    """Create a SessionConfiguration for video adapter tests."""
    return SessionConfiguration(
        ticket_id=ticket_id,
        ticket_dir=ticket_dir,
        file_system=file_system,
        segments=segments or [],
        function_groups=[],
        function_filter=[],
        model=model,
    )


def _mock_successful_veo(mock_client_instance, video_bytes=b"dummy-mp4"):
    """Wire up mock httpx client for a successful Veo generation cycle."""
    # POST → predictLongRunning
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200
    mock_post_res.json.return_value = {"name": "operations/veo-op-123"}
    mock_client_instance.post = AsyncMock(return_value=mock_post_res)

    # GET → polling (done immediately) + video download
    mock_poll_res = MagicMock()
    mock_poll_res.status_code = 200
    mock_poll_res.json.return_value = {
        "done": True,
        "response": {
            "generateVideoResponse": {
                "generatedSamples": [
                    {"video": {"uri": "https://fake-video-download-uri"}}
                ]
            }
        },
    }

    mock_video_res = MagicMock()
    mock_video_res.status_code = 200
    mock_video_res.content = video_bytes

    async def side_effect_get(url, **kwargs):
        if "operations/veo-op-123" in url:
            return mock_poll_res
        return mock_video_res

    mock_client_instance.get = AsyncMock(side_effect=side_effect_get)


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

        config = _make_config(
            self.ticket_dir,
            self.file_system,
            ticket_id="test-video-task",
        )

        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client_instance
            _mock_successful_veo(mock_client_instance)

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
            called_json = mock_client_instance.post.call_args[1]["json"]
            self.assertEqual(called_json["instances"][0]["prompt"], "Cinematic view of a forest")
            # Default aspect ratio when no options provided
            self.assertEqual(called_json["parameters"]["aspectRatio"], "16:9")

            # Verify streaming events
            self.assertTrue("sendRequest" in events[0])
            self.assertTrue("complete" in events[-1])
            self.assertTrue(events[-1]["complete"]["result"]["success"])

            # Verify MP4 file output
            output_file = self.fs_dir / "intro" / "video_0.mp4"
            self.assertTrue(output_file.is_file())

            # Verify URI sidecar was persisted for future extension.
            uri_sidecar = self.fs_dir / "intro" / "video_0.uri.json"
            self.assertTrue(uri_sidecar.is_file())
            sidecar_data = json.loads(uri_sidecar.read_text(encoding="utf-8"))
            self.assertEqual(
                sidecar_data["uri"], "https://fake-video-download-uri",
            )

    def test_execute_video_adapter_safety_error(self):
        metadata = {
            "slug": "intro",
            "tags": ["video"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("Unsafe video prompt", encoding="utf-8")

        config = _make_config(
            self.ticket_dir,
            self.file_system,
            ticket_id="test-video-safety-task",
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

        config = _make_config(
            self.ticket_dir,
            self.file_system,
            ticket_id="test-video-resume-task",
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
            self.assertEqual(len(events), 7)
            mock_client_instance.post.assert_called_once()
            self.assertEqual(mock_client_instance.get.call_count, 3)

            # Sidecar file should be unlinked
            self.assertFalse(state_file.exists())

            # Verify final delivery
            output_file = self.fs_dir / "intro" / "video_0.mp4"
            self.assertTrue(output_file.is_file())
            self.assertEqual(output_file.read_bytes(), b"fallback-mp4-bytes")

    # ------------------------------------------------------------------
    # Phase 6 tests: options plumbing, media inputs, and error handling
    # ------------------------------------------------------------------

    def test_options_parameters_plumbing(self):
        """Options map correctly into the Veo REST parameters block."""
        metadata = {
            "slug": "clip",
            "tags": ["video"],
            "options": {
                "aspect_ratio": "9:16",
                "resolution": "1080p",
                "duration_seconds": 8,
                "person_generation": "allow_adult",
            },
        }
        (self.ticket_dir / "metadata.json").write_text(
            json.dumps(metadata), encoding="utf-8",
        )
        (self.ticket_dir / "objective.md").write_text(
            "A dancer performing a pirouette", encoding="utf-8",
        )

        config = _make_config(self.ticket_dir, self.file_system)
        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = (
                mock_client_instance
            )
            _mock_successful_veo(mock_client_instance)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")
            events = asyncio.run(self._collect_events(runner, config))

            called_json = mock_client_instance.post.call_args[1]["json"]
            params = called_json["parameters"]

            self.assertEqual(params["aspectRatio"], "9:16")
            self.assertEqual(params["resolution"], "1080p")
            self.assertEqual(params["durationSeconds"], "8")
            self.assertEqual(params["personGeneration"], "allow_adult")
            self.assertTrue(events[-1]["complete"]["result"]["success"])

    def test_video_continuation(self):
        """extend_video option reads URI sidecar and sends server-side reference."""
        # Write a dummy video + its URI sidecar to the filesystem.
        video_dir = self.fs_dir / "intro"
        video_dir.mkdir(parents=True, exist_ok=True)
        dummy_video = b"\x00\x00\x00\x1cftypisom"  # Fake MP4 header bytes
        (video_dir / "video_0.mp4").write_bytes(dummy_video)
        # Sidecar persisted by a previous generation
        (video_dir / "video_0.uri.json").write_text(
            json.dumps({"uri": "https://fake-veo-uri/video/abc123"}),
            encoding="utf-8",
        )

        metadata = {
            "slug": "intro",
            "tags": ["video"],
            "options": {
                "extend_video": "intro/video_0.mp4",
            },
        }
        (self.ticket_dir / "metadata.json").write_text(
            json.dumps(metadata), encoding="utf-8",
        )
        (self.ticket_dir / "objective.md").write_text(
            "Track the butterfly into the garden", encoding="utf-8",
        )

        config = _make_config(self.ticket_dir, self.file_system)
        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = (
                mock_client_instance
            )
            _mock_successful_veo(mock_client_instance)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")
            events = asyncio.run(self._collect_events(runner, config))

            called_json = mock_client_instance.post.call_args[1]["json"]
            instance = called_json["instances"][0]
            params = called_json["parameters"]

            # Verify video is sent as a server-side URI reference.
            self.assertIn("video", instance)
            self.assertEqual(
                instance["video"],
                {"uri": "https://fake-veo-uri/video/abc123"},
            )

            # Verify extension constraint: resolution forced to 720p.
            self.assertEqual(params["resolution"], "720p")
            self.assertNotIn("numberOfVideos", params)

            self.assertTrue(events[-1]["complete"]["result"]["success"])

    def test_keyframe_interpolation(self):
        """first_frame and last_frame options map to instances[0].image and .lastFrame."""
        # Write two dummy images.
        start_bytes = b"\x89PNG\x00START_FRAME"
        end_bytes = b"\x89PNG\x00END_FRAME"
        (self.fs_dir / "start.png").write_bytes(start_bytes)
        (self.fs_dir / "end.png").write_bytes(end_bytes)

        metadata = {
            "slug": "transition",
            "tags": ["video"],
            "options": {
                "first_frame": "start.png",
                "last_frame": "end.png",
            },
        }
        (self.ticket_dir / "metadata.json").write_text(
            json.dumps(metadata), encoding="utf-8",
        )
        (self.ticket_dir / "objective.md").write_text(
            "A smooth transition between two scenes", encoding="utf-8",
        )

        config = _make_config(self.ticket_dir, self.file_system)
        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = (
                mock_client_instance
            )
            _mock_successful_veo(mock_client_instance)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")
            events = asyncio.run(self._collect_events(runner, config))

            called_json = mock_client_instance.post.call_args[1]["json"]
            instance = called_json["instances"][0]

            # Verify starting frame (Veo-native format).
            self.assertIn("image", instance)
            self.assertIn("bytesBase64Encoded", instance["image"])
            decoded_start = base64.b64decode(
                instance["image"]["bytesBase64Encoded"],
            )
            self.assertEqual(decoded_start, start_bytes)

            # Verify ending frame (Veo-native format).
            self.assertIn("lastFrame", instance)
            self.assertIn("bytesBase64Encoded", instance["lastFrame"])
            decoded_end = base64.b64decode(
                instance["lastFrame"]["bytesBase64Encoded"],
            )
            self.assertEqual(decoded_end, end_bytes)

            self.assertTrue(events[-1]["complete"]["result"]["success"])

    def test_reference_images(self):
        """reference_images option maps to instances[0].referenceImages array."""
        # Write three dummy reference images.
        for name in ["dress.png", "glasses.png", "person.png"]:
            (self.fs_dir / name).write_bytes(b"\x89PNG\x00" + name.encode())

        metadata = {
            "slug": "styled",
            "tags": ["video"],
            "options": {
                "reference_images": [
                    "dress.png",
                    "glasses.png",
                    "person.png",
                ],
            },
        }
        (self.ticket_dir / "metadata.json").write_text(
            json.dumps(metadata), encoding="utf-8",
        )
        (self.ticket_dir / "objective.md").write_text(
            "A fashion model walking through a lagoon", encoding="utf-8",
        )

        config = _make_config(self.ticket_dir, self.file_system)
        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = (
                mock_client_instance
            )
            _mock_successful_veo(mock_client_instance)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")
            events = asyncio.run(self._collect_events(runner, config))

            called_json = mock_client_instance.post.call_args[1]["json"]
            instance = called_json["instances"][0]

            # Verify referenceImages array.
            self.assertIn("referenceImages", instance)
            refs = instance["referenceImages"]
            self.assertEqual(len(refs), 3)

            for ref in refs:
                self.assertEqual(ref["referenceType"], "asset")
                self.assertIn("image", ref)
                self.assertIn("bytesBase64Encoded", ref["image"])

            self.assertTrue(events[-1]["complete"]["result"]["success"])

    def test_media_file_not_found(self):
        """Adapter reports a clear error when a media file path doesn't exist."""
        metadata = {
            "slug": "broken",
            "tags": ["video"],
            "options": {
                "first_frame": "nonexistent.png",
            },
        }
        (self.ticket_dir / "metadata.json").write_text(
            json.dumps(metadata), encoding="utf-8",
        )
        (self.ticket_dir / "objective.md").write_text(
            "A video from a missing frame", encoding="utf-8",
        )

        config = _make_config(self.ticket_dir, self.file_system)
        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = (
                mock_client_instance
            )
            _mock_successful_veo(mock_client_instance)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")
            events = asyncio.run(self._collect_events(runner, config))

            # Should get an error event, not a crash.
            self.assertTrue("error" in events[-1])
            err_msg = events[-1]["error"]["message"]
            self.assertIn("nonexistent.png", err_msg)

            # POST should never have been called.
            mock_client_instance.post.assert_not_called()

    def test_extension_missing_sidecar(self):
        """Extension fails with clear error when URI sidecar is missing."""
        # Write a video file but NO sidecar.
        video_dir = self.fs_dir / "intro"
        video_dir.mkdir(parents=True, exist_ok=True)
        (video_dir / "video_0.mp4").write_bytes(b"\x00\x00fake-video")

        metadata = {
            "slug": "intro",
            "tags": ["video"],
            "options": {
                "extend_video": "intro/video_0.mp4",
            },
        }
        (self.ticket_dir / "metadata.json").write_text(
            json.dumps(metadata), encoding="utf-8",
        )
        (self.ticket_dir / "objective.md").write_text(
            "Extend the video", encoding="utf-8",
        )

        config = _make_config(self.ticket_dir, self.file_system)
        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = (
                mock_client_instance
            )
            _mock_successful_veo(mock_client_instance)

            runner = DirectModelRunner(mock_backend, api_key="fake-key")
            events = asyncio.run(self._collect_events(runner, config))

            # Should get an error about missing sidecar.
            self.assertTrue("error" in events[-1])
            err_msg = events[-1]["error"]["message"]
            self.assertIn("URI sidecar", err_msg)
            self.assertIn("video_0.uri.json", err_msg)

            # POST should never have been called.
            mock_client_instance.post.assert_not_called()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _collect_events(
        self, runner: DirectModelRunner, config: SessionConfiguration,
    ) -> list:
        stream = await runner.run(config)
        events = []
        async for event in stream:
            events.append(event)
        return events


if __name__ == "__main__":
    unittest.main()

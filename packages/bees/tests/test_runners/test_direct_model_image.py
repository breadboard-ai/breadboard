# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import asyncio
import json
import unittest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from bees.protocols.session import SessionConfiguration
from bees.runners.direct_model import DirectModelRunner, DirectModelStream
from bees.disk_file_system import DiskFileSystem


class TestDirectModelImageAdapter(unittest.TestCase):
    """Test ImageAdapter execution, REST API payload, and PNG file output."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.mkdtemp()
        self.ticket_dir = Path(self.tmp_dir)
        self.fs_dir = self.ticket_dir / "filesystem"
        self.fs_dir.mkdir(parents=True, exist_ok=True)
        self.file_system = DiskFileSystem(self.fs_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp_dir)

    def test_execute_image_adapter_success(self):
        # Prepare ticket metadata with slug and image tag
        metadata = {
            "slug": "logo",
            "tags": ["image"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("A sleek vector logo of a bee", encoding="utf-8")

        config = SessionConfiguration(
            ticket_id="test-image-task",
            ticket_dir=self.ticket_dir,
            file_system=self.file_system,
            segments=[],
            function_groups=[],
            function_filter=[],
            model="gemini-3.1-flash-image-preview"
        )

        mock_backend = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client_instance = MagicMock()
            mock_client_class.return_value.__aenter__.return_value = mock_client_instance

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
                                        "mimeType": "image/png",
                                        "data": "iVBORw0KGgo="  # dummy base64 PNG header
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

            # 1. Verify httpx API was called with correct parameters
            mock_client_instance.post.assert_called_once()
            called_url = mock_client_instance.post.call_args[0][0]
            called_kwargs = mock_client_instance.post.call_args[1]
            self.assertEqual(
                called_url,
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=fake-api-key"
            )
            self.assertEqual(
                called_kwargs["json"]["contents"][0]["parts"][0]["text"],
                "A sleek vector logo of a bee"
            )

            # 2. Verify streaming events
            # We expect 1 sendRequest event and 1 complete event
            self.assertEqual(len(events), 2)
            self.assertTrue("sendRequest" in events[0])
            self.assertTrue("complete" in events[1])
            self.assertTrue(events[1]["complete"]["result"]["success"])
            self.assertEqual(len(events[1]["complete"]["result"]["intermediate"]), 1)

            # 3. Verify file generation under sandboxed slug directory
            output_file = self.fs_dir / "logo" / "image_0.png"
            self.assertTrue(output_file.is_file())
            self.assertEqual(output_file.read_bytes(), b"\x89PNG\r\n\x1a\n")


if __name__ == "__main__":
    unittest.main()

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

import asyncio
import json
import unittest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from bees.protocols.session import SessionConfiguration, SessionStream, SessionRunner
from bees.runners.direct_model import DirectModelRunner, DirectModelStream
from bees.disk_file_system import DiskFileSystem


class TestDirectModelConformance(unittest.TestCase):
    """Test DirectModel stream and runner satisfy the protocols."""

    def test_satisfies_session_stream(self):
        from bees.protocols.session import SessionStream

        config = MagicMock(spec=SessionConfiguration)
        config.ticket_dir = None
        config.segments = []

        stream = DirectModelStream(asyncio.Queue(), config, MagicMock(), MagicMock())
        self.assertIsInstance(stream, SessionStream)

    def test_satisfies_session_runner(self):
        from bees.protocols.session import SessionRunner

        runner = DirectModelRunner(MagicMock())
        self.assertIsInstance(runner, SessionRunner)


class TestDirectModelTextAdapter(unittest.TestCase):
    """Test TextAdapter execution, streaming, and file output."""

    def setUp(self) -> None:
        self.tmp_dir = tempfile.mkdtemp()
        self.ticket_dir = Path(self.tmp_dir)
        self.fs_dir = self.ticket_dir / "filesystem"
        self.fs_dir.mkdir(parents=True, exist_ok=True)
        self.file_system = DiskFileSystem(self.fs_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp_dir)

    def test_execute_text_adapter_success(self):
        # Prepare ticket metadata with slug
        metadata = {
            "slug": "memo",
            "tags": ["text"]
        }
        (self.ticket_dir / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (self.ticket_dir / "objective.md").write_text("Generate a nice memo", encoding="utf-8")

        config = SessionConfiguration(
            ticket_id="test-task",
            ticket_dir=self.ticket_dir,
            file_system=self.file_system,
            segments=[],
            function_groups=[],
            function_filter=[],
            model="gemini-3-flash-preview"
        )

        mock_backend = MagicMock()

        # Mock stream_generate_content chunks
        mock_chunks = [
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "This is thinking...", "thought": True}
                            ]
                        }
                    }
                ]
            },
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "Here is the final output content."}
                            ]
                        }
                    }
                ]
            }
        ]

        async def mock_generator(*args, **kwargs):
            for chunk in mock_chunks:
                yield chunk

        with patch("bees.runners.direct_model.stream_generate_content", side_effect=mock_generator) as mock_stream:
            runner = DirectModelRunner(mock_backend)

            async def run_stream():
                stream = await runner.run(config)
                events = []
                async for event in stream:
                    events.append(event)
                return events

            events = asyncio.run(run_stream())

            # 1. Verify mock API was called with correct parameters
            mock_stream.assert_called_once()
            called_model = mock_stream.call_args[0][0]
            called_body = mock_stream.call_args[0][1]
            self.assertEqual(called_model, "gemini-3-flash-preview")
            self.assertEqual(called_body["contents"][0]["parts"][0]["text"], "Generate a nice memo")

            # 2. Verify streaming events
            # We expect 1 sendRequest event, 1 reasoning thought event, and 1 complete event
            self.assertEqual(len(events), 3)
            self.assertTrue("sendRequest" in events[0])
            self.assertEqual(events[1], {"thought": {"text": "This is thinking..."}})
            self.assertTrue("complete" in events[2])
            self.assertTrue(events[2]["complete"]["result"]["success"])

            # 3. Verify file generation under sandboxed slug directory
            output_file = self.fs_dir / "memo" / "text.md"
            self.assertTrue(output_file.is_file())
            self.assertEqual(output_file.read_text(encoding="utf-8"), "Here is the final output content.")


if __name__ == "__main__":
    unittest.main()

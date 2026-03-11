"""Tests for the Ark pidgin translator."""

import pytest

from ark_backend.ark_pidgin import (
    FileReader,
    TextFileReader,
    from_pidgin_string,
)


# ---------------------------------------------------------------------------
# TextFileReader
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_text_reader_reads_file(tmp_path):
    (tmp_path / "hello.txt").write_text("world")
    reader = TextFileReader(tmp_path)
    result = await reader.read("hello.txt")
    assert result == {"parts": [{"text": "world"}]}


@pytest.mark.asyncio
async def test_text_reader_file_not_found(tmp_path):
    reader = TextFileReader(tmp_path)
    result = await reader.read("missing.txt")
    assert "$error" in result


@pytest.mark.asyncio
async def test_text_reader_path_traversal(tmp_path):
    reader = TextFileReader(tmp_path)
    result = await reader.read("../../etc/passwd")
    assert "$error" in result
    assert "outside" in result["$error"].lower()


@pytest.mark.asyncio
async def test_text_reader_binary_file(tmp_path):
    (tmp_path / "image.bin").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
    reader = TextFileReader(tmp_path)
    result = await reader.read("image.bin")
    assert "$error" in result
    assert "text-only" in result["$error"].lower()


# ---------------------------------------------------------------------------
# Protocol compliance
# ---------------------------------------------------------------------------


def test_text_reader_is_file_reader(tmp_path):
    reader = TextFileReader(tmp_path)
    assert isinstance(reader, FileReader)


# ---------------------------------------------------------------------------
# from_pidgin_string
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_tags(tmp_path):
    reader = TextFileReader(tmp_path)
    result = await from_pidgin_string("Just plain text", reader)
    assert result == {"parts": [{"text": "Just plain text"}]}


@pytest.mark.asyncio
async def test_single_file_tag(tmp_path):
    (tmp_path / "data.txt").write_text("file content here")
    reader = TextFileReader(tmp_path)
    result = await from_pidgin_string(
        'See: <file src="data.txt" />', reader
    )
    parts = result["parts"]
    assert len(parts) == 2
    assert parts[0]["text"] == "See: "
    assert parts[1]["text"] == "file content here"


@pytest.mark.asyncio
async def test_multiple_file_tags(tmp_path):
    (tmp_path / "a.txt").write_text("AAA")
    (tmp_path / "b.txt").write_text("BBB")
    reader = TextFileReader(tmp_path)
    result = await from_pidgin_string(
        'Start <file src="a.txt" /> middle <file src="b.txt" /> end',
        reader,
    )
    texts = [p["text"] for p in result["parts"]]
    assert "AAA" in texts
    assert "BBB" in texts
    assert "Start " in texts
    assert " end" in texts


@pytest.mark.asyncio
async def test_missing_file_inlines_error(tmp_path):
    reader = TextFileReader(tmp_path)
    result = await from_pidgin_string(
        '<file src="missing.txt" />', reader
    )
    parts = result["parts"]
    assert len(parts) == 1
    assert "Error" in parts[0]["text"]


@pytest.mark.asyncio
async def test_empty_string(tmp_path):
    reader = TextFileReader(tmp_path)
    result = await from_pidgin_string("", reader)
    assert result == {"parts": [{"text": ""}]}


@pytest.mark.asyncio
async def test_mock_multimodal_reader(tmp_path):
    """Proves the resolver is reader-agnostic: a mock reader returning
    inlineData parts works without any changes to from_pidgin_string."""

    class MockMultimodalReader:
        async def read(self, path):
            return {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": "base64data==",
                        }
                    }
                ]
            }

    reader = MockMultimodalReader()
    result = await from_pidgin_string(
        'Image: <file src="photo.png" />', reader
    )
    parts = result["parts"]
    assert len(parts) == 2
    assert parts[0]["text"] == "Image: "
    assert "inlineData" in parts[1]
    assert parts[1]["inlineData"]["mimeType"] == "image/png"

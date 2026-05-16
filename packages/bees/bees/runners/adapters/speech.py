# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import base64
import struct
from typing import Any, Callable

import httpx

from bees.pidgin import from_pidgin_string
from bees.protocols.session import SessionConfiguration
from opal_backend.local.backend_client_impl import HttpBackendClient


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
    """Wrap raw headerless 16-bit linear PCM samples in a standard RIFF WAV header."""
    if pcm_bytes.startswith(b"RIFF") or pcm_bytes.startswith(b"ID3") or pcm_bytes.startswith(b"\xff\xfb"):
        return pcm_bytes

    num_channels = 1
    bits_per_sample = 16
    data_size = len(pcm_bytes)
    chunk_size = 36 + data_size
    byte_rate = sample_rate * num_channels * (bits_per_sample // 8)
    block_align = num_channels * (bits_per_sample // 8)

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size
    )
    return header + pcm_bytes


# ---------------------------------------------------------------------------
# Voice preset mapping & speech config builder
# ---------------------------------------------------------------------------

# Maps legacy/generic voice aliases to Gemini prebuilt voice names.
_VOICE_PRESET_MAP: dict[str, str] = {
    "female": "Kore",
    "male": "Puck",
    "female (english)": "Kore",
    "male (english)": "Puck",
    "en-us-female": "Kore",
    "en-us-male": "Puck",
}


def _resolve_voice(name: str) -> str:
    """Resolve a voice name through the legacy preset map."""
    return _VOICE_PRESET_MAP.get(name.lower(), name)


def _parse_speaker(value: str) -> tuple[str, str] | None:
    """Parse a flat ``"Alias:VoiceName"`` string into (alias, voice).

    Returns ``None`` if the format is invalid.
    """
    if ":" not in value:
        return None
    alias, _, voice = value.partition(":")
    alias = alias.strip()
    voice = voice.strip()
    if not alias or not voice:
        return None
    return (alias, _resolve_voice(voice))


def _build_speech_config(
    voice_preset: str,
    options: dict[str, Any] | None,
) -> dict[str, Any]:
    """Build the ``speechConfig`` block for the Gemini TTS REST payload.

    When ``speaker_1`` and ``speaker_2`` options are present (flat strings in
    ``"Alias:VoiceName"`` format), produces a ``multiSpeakerVoiceConfig``
    payload for multi-speaker dialogue. Otherwise, produces a single-speaker
    ``voiceConfig`` payload.
    """
    opts = options or {}
    speaker_1 = opts.get("speaker_1")
    speaker_2 = opts.get("speaker_2")

    if speaker_1 and speaker_2:
        parsed = [
            _parse_speaker(str(speaker_1)),
            _parse_speaker(str(speaker_2)),
        ]
        # Only switch to multi-speaker if both parse successfully.
        valid = [p for p in parsed if p is not None]
        if len(valid) == 2:
            speaker_configs = [
                {
                    "speaker": alias,
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": voice,
                        }
                    },
                }
                for alias, voice in valid
            ]
            return {
                "multiSpeakerVoiceConfig": {
                    "speakerVoiceConfigs": speaker_configs,
                }
            }

    # Single-speaker mode.
    resolved = _resolve_voice(voice_preset)
    return {
        "voiceConfig": {
            "prebuiltVoiceConfig": {
                "voiceName": resolved,
            }
        },
    }

class SpeechAdapter:
    """Adapter for direct speech generation (TTS) via Gemini REST API.

    Supports:
    - Single-speaker voice selection via ``options.voice`` or segment config.
    - Multi-speaker dialogue via ``speaker_1``/``speaker_2`` options
      which switches the payload to ``multiSpeakerVoiceConfig``.
    - Audio tags in the transcript for expressive control (``[whispers]``,
      ``[laughs]``, ``[excitedly]``).
    """

    async def generate(
        self,
        config: SessionConfiguration,
        slug: str | None,
        log_event: Callable[[dict[str, Any]], Any],
        backend: HttpBackendClient,
        api_key: str,
        options: dict[str, Any] | None = None,
    ) -> None:
        # Combine text segments to form prompt
        prompt_parts = []
        voice_preset = "Kore"  # Default voice (firm, clear)

        for segment in config.segments:
            seg_type = segment.get("type")
            if seg_type == "text":
                text = segment.get("text", "")
                if text:
                    prompt_parts.append(text)
            elif seg_type == "input":
                content = segment.get("content", {})
                for part in content.get("parts", []):
                    if "text" in part:
                        prompt_parts.append(part["text"])
            elif seg_type == "voice":
                voice_preset = segment.get("voice_name", segment.get("voice", voice_preset))

        # Options-based voice override takes precedence over segment config.
        if options and "voice" in options:
            voice_preset = options["voice"]

        prompt = "\n".join(prompt_parts).strip()

        # Fallback to objective.md if prompt is empty
        if not prompt and config.ticket_dir:
            objective_path = config.ticket_dir / "objective.md"
            if objective_path.is_file():
                prompt = objective_path.read_text(encoding="utf-8").strip()

        if not prompt:
            raise ValueError("Direct speech generation failed: Empty prompt / objective")

        # Translate pidgin references (resolving files)
        translated = await from_pidgin_string(prompt, config.file_system)
        if isinstance(translated, dict) and "$error" in translated:
            raise ValueError(translated["$error"])

        resolved_model = config.model or "gemini-3.1-flash-tts-preview"

        # Build speech config: multi-speaker or single-speaker.
        speech_config = _build_speech_config(voice_preset, options)

        body: dict[str, Any] = {
            "contents": [translated],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": speech_config,
            }
        }

        send_request_event = {
            "sendRequest": {
                "body": {
                    "model": resolved_model,
                    "contents": body["contents"],
                    "generationConfig": body["generationConfig"],
                }
            }
        }
        await log_event(send_request_event)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{resolved_model}:generateContent?key={api_key}"
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            res = await client.post(url, json=body, headers={"Content-Type": "application/json"})
            if res.status_code != 200:
                raise ValueError(f"Gemini speech generation failed ({res.status_code}): {res.text}")
            data = res.json()

        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("No candidates returned from Gemini speech generation")

        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            raise ValueError("No parts returned from Gemini speech generation")

        intermediate_files = []
        for i, part in enumerate(parts):
            if "inlineData" in part:
                file_name = f"{slug}/audio_{i}.wav" if slug else f"audio_{i}.wav"
                
                # Gemini returns headerless s16le PCM bytes. Wrap in playable WAV container.
                try:
                    raw_pcm = base64.b64decode(part["inlineData"].get("data", ""))
                    wav_bytes = _pcm_to_wav(raw_pcm)
                    part["inlineData"]["data"] = base64.b64encode(wav_bytes).decode("ascii")
                except Exception:
                    pass

                part["inlineData"]["mimeType"] = "audio/wav"
                
                saved_path = config.file_system.add_part(part, file_name=file_name)
                if isinstance(saved_path, dict) and "$error" in saved_path:
                    raise ValueError(saved_path["$error"])
                intermediate_files.append({
                    "path": file_name,
                    "content": part
                })

        if not intermediate_files:
            raise ValueError("No speech was generated by the model")

        # Formulate outcome matching single-file deliverable pattern
        final_path = intermediate_files[0]["path"]
        complete_event = {
            "complete": {
                "result": {
                    "success": True,
                    "outcomes": {
                        "parts": [{"text": f"Result written to {final_path}"}]
                    },
                    "intermediate": intermediate_files
                }
            }
        }
        await log_event(complete_event)

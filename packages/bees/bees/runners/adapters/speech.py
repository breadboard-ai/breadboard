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


class SpeechAdapter:
    """Adapter for direct speech generation (TTS) via Gemini REST API."""

    async def generate(
        self,
        config: SessionConfiguration,
        slug: str | None,
        log_event: Callable[[dict[str, Any]], Any],
        backend: HttpBackendClient,
        api_key: str,
    ) -> None:
        # Combine text segments to form prompt
        prompt_parts = []
        voice_preset = "Kore"  # Default voice (firm female)

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

        # Translate voice presets (mapping standard male/female presets to Gemini prebuilt voices)
        preset_map = {
            "female": "Kore",
            "male": "Puck",
            "female (english)": "Kore",
            "male (english)": "Puck",
            "en-us-female": "Kore",
            "en-us-male": "Puck",
        }
        resolved_voice = preset_map.get(voice_preset.lower(), voice_preset)

        resolved_model = config.model or "gemini-3.1-flash-tts-preview"

        body: dict[str, Any] = {
            "contents": [translated],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": resolved_voice
                        }
                    }
                }
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

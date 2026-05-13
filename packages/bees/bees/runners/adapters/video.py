# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import asyncio
import base64
import json
import re
from typing import Any, Callable

import httpx

from bees.pidgin import from_pidgin_string
from bees.protocols.session import SessionConfiguration
from opal_backend.local.backend_client_impl import HttpBackendClient


class VeoGenerationError(ValueError):
    """Veo video generation error carrying structured metadata."""

    def __init__(self, message: str, error_dict: dict[str, Any]) -> None:
        super().__init__(message)
        self.error_dict = error_dict


# Veo safety-code expansion mapping cloned from generate.py
SUPPORT_CODES: dict[int, str] = {
    58061214: "child",
    17301594: "child",
    29310472: "celebrity",
    15236754: "celebrity",
    64151117: "unsafe",
    42237218: "unsafe",
    62263041: "dangerous",
    57734940: "hate",
    22137204: "hate",
    74803281: "other",
    29578790: "other",
    42876398: "other",
    39322892: "face",
    92201652: "pii",
    89371032: "prohibited",
    49114662: "prohibited",
    72817394: "prohibited",
    90789179: "sexual",
    63429089: "sexual",
    43188360: "sexual",
    78610348: "toxic",
    61493863: "violence",
    56562880: "violence",
    32635315: "vulgar",
}

_SUPPORT_CODE_RE = re.compile(r"Support codes: ([\d, ]+)")


def expand_veo_error(error_message: str, model: str) -> dict[str, Any]:
    """Expand a Veo error message with safety reason metadata."""
    match = _SUPPORT_CODE_RE.search(error_message)
    reasons: set[str] = set()

    if match:
        codes = [int(c.strip()) for c in match.group(1).split(",")]
        for code in codes:
            reasons.add(SUPPORT_CODES.get(code, "other"))

    if reasons:
        return {
            "error": error_message,
            "metadata": {
                "origin": "server",
                "kind": "safety",
                "reasons": sorted(reasons),
                "model": model,
            },
        }

    return {"error": error_message}


class VideoAdapter:
    """Adapter for direct video generation via Veo REST API with persistent polling resumption."""

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

        prompt = "\n".join(prompt_parts).strip()

        # Fallback to objective.md if prompt is empty
        if not prompt and config.ticket_dir:
            objective_path = config.ticket_dir / "objective.md"
            if objective_path.is_file():
                prompt = objective_path.read_text(encoding="utf-8").strip()

        if not prompt:
            raise ValueError("Direct video generation failed: Empty prompt / objective")

        # Translate pidgin references (resolving files)
        translated = await from_pidgin_string(prompt, config.file_system)
        if isinstance(translated, dict) and "$error" in translated:
            raise ValueError(translated["$error"])

        resolved_model = config.model or "veo-3.1-generate-preview"

        aspect_ratio = "16:9"
        for segment in config.segments:
            if segment.get("type") == "aspect_ratio":
                aspect_ratio = segment.get("aspect_ratio", "16:9")

        prompt_str = ""
        if isinstance(translated, dict):
            parts = translated.get("parts", [])
            prompt_str = "".join(p.get("text", "") for p in parts if "text" in p)
        elif isinstance(translated, str):
            prompt_str = translated

        body: dict[str, Any] = {
            "instances": [{"prompt": prompt_str}],
            "parameters": {"aspectRatio": aspect_ratio},
        }

        send_request_event = {
            "sendRequest": {
                "body": {
                    "model": resolved_model,
                    "contents": [translated],
                    "instances": body["instances"],
                    "parameters": body["parameters"],
                }
            }
        }
        await log_event(send_request_event)

        # Dedicated sidecar file for tracking persistent polling state
        state_file = config.ticket_dir / "polling_state.json" if config.ticket_dir else None
        operation_name = None

        # 1. Check if resumption sidecar exists to resume polling directly
        if state_file and state_file.is_file():
            try:
                sdata = json.loads(state_file.read_text(encoding="utf-8"))
                operation_name = sdata.get("operation_name")
                if operation_name:
                    await log_event({"systemMessage": {"text": f"Resuming polling for active operation {operation_name}"}})
            except Exception:
                pass  # File unreadable, fallback to fresh generation

        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            video_uri = None
            err_msg = ""

            while True:
                # 2. Fresh Generation Path if no active operation_name
                if not operation_name:
                    start_url = f"https://generativelanguage.googleapis.com/v1beta/models/{resolved_model}:predictLongRunning?key={api_key}"
                    res = await client.post(start_url, json=body, headers={"Content-Type": "application/json"})
                    if res.status_code != 200:
                        err_msg = f"Veo video generation failed ({res.status_code}): {res.text}"
                        expanded = expand_veo_error(err_msg, resolved_model)
                        raise VeoGenerationError(err_msg, expanded)
                    data = res.json()

                    operation_name = data.get("name")
                    if not operation_name:
                        raise ValueError("No operation name returned from Veo video generation")

                    await log_event({
                        "systemMessage": {
                            "text": f"Initiated polling for active operation {operation_name}"
                        }
                    })

                    # Persist operation name immediately to sidecar
                    if state_file:
                        try:
                            state_file.write_text(json.dumps({"operation_name": operation_name}), encoding="utf-8")
                        except Exception:
                            pass

                # 3. Polling Loop with self-healing fallback
                poll_url = f"https://generativelanguage.googleapis.com/v1beta/{operation_name}?key={api_key}"
                polling_failed = False

                while True:
                    await log_event({
                        "systemMessage": {
                            "text": f"Polling operation {operation_name}..."
                        }
                    })
                    poll_res = await client.get(poll_url)
                    if poll_res.status_code != 200:
                        err_msg = f"Veo operation polling failed ({poll_res.status_code}): {poll_res.text}"
                        polling_failed = True
                        break

                    poll_data = poll_res.json()
                    if "error" in poll_data:
                        err_obj = poll_data["error"]
                        err_msg = err_obj.get("message", json.dumps(err_obj))
                        polling_failed = True
                        break

                    if poll_data.get("done"):
                        try:
                            video_uri = poll_data["response"]["generateVideoResponse"]["generatedSamples"][0]["video"]["uri"]
                        except (KeyError, IndexError, TypeError):
                            raise ValueError(f"Malformed Veo completion response: {json.dumps(poll_data)}")
                        break

                    await asyncio.sleep(5.0)

                # 4. Intercept Polling Failure for Self-Healing Fallback
                if polling_failed:
                    if state_file and state_file.exists():
                        state_file.unlink(missing_ok=True)
                        await log_event({
                            "systemMessage": {
                                "text": f"Polling unrecoverable for {operation_name}. Falling back to fresh video generation."
                            }
                        })
                        operation_name = None
                        continue  # Outer loop loops back to trigger fresh generation POST

                    # If fresh generation failed during polling -> fatal safety/service error
                    expanded = expand_veo_error(err_msg, resolved_model)
                    raise VeoGenerationError(err_msg, expanded)

                # Polling successful
                break

            # 5. Download binary final video deliverable
            video_res = await client.get(
                video_uri,
                headers={"x-goog-api-key": api_key},
                follow_redirects=True,
            )
            if video_res.status_code != 200:
                raise ValueError(f"Failed to download generated video ({video_res.status_code}): {video_res.text}")
            raw_bytes = video_res.content

            # Clean up persistence sidecar upon absolute success
            if state_file and state_file.exists():
                state_file.unlink(missing_ok=True)

        encoded_data = base64.b64encode(raw_bytes).decode("ascii")
        part = {
            "inlineData": {
                "mimeType": "video/mp4",
                "data": encoded_data
            }
        }

        file_name = f"{slug}/video_0.mp4" if slug else "video_0.mp4"
        saved_path = config.file_system.add_part(part, file_name=file_name)
        if isinstance(saved_path, dict) and "$error" in saved_path:
            raise ValueError(saved_path["$error"])

        complete_event = {
            "complete": {
                "result": {
                    "success": True,
                    "outcomes": {
                        "parts": [{"text": f"Result written to {file_name}"}]
                    },
                    "intermediate": [
                        {
                            "path": file_name,
                            "content": part
                        }
                    ]
                }
            }
        }
        await log_event(complete_event)

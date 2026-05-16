# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from typing import Any, Callable

import httpx

from bees.pidgin import from_pidgin_string
from bees.protocols.filesystem import FileSystem
from bees.protocols.session import SessionConfiguration
from opal_backend.local.backend_client_impl import HttpBackendClient

logger = logging.getLogger("bees.runners.adapters.video")


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


# ---------------------------------------------------------------------------
# Options → Veo REST parameter mapping
# ---------------------------------------------------------------------------


def _build_parameters(options: dict[str, Any] | None) -> dict[str, Any]:
    """Map user-facing options into the Veo REST ``parameters`` block.

    Always returns at least ``{"aspectRatio": "16:9"}`` as a default.
    """
    params: dict[str, Any] = {}

    if not options:
        params["aspectRatio"] = "16:9"
        return params

    aspect_ratio = options.get("aspect_ratio", "16:9")
    params["aspectRatio"] = aspect_ratio

    resolution = options.get("resolution")
    if resolution:
        params["resolution"] = resolution

    duration_seconds = options.get("duration_seconds")
    if duration_seconds is not None:
        # Veo REST expects durationSeconds as a string.
        params["durationSeconds"] = str(int(duration_seconds))

    person_generation = options.get("person_generation")
    if person_generation:
        params["personGeneration"] = person_generation

    return params


async def _resolve_file_to_veo_media(
    path: str, file_system: FileSystem,
) -> dict[str, Any]:
    """Resolve a workspace file path to a Veo-compatible media dict.

    The Veo ``predictLongRunning`` endpoint uses a flat media format::

        {"bytesBase64Encoded": "...", "mimeType": "..."}

    This differs from Gemini's ``inlineData`` wrapper. ``FileSystem.get()``
    returns the Gemini format, so we unwrap and re-key it here.

    Raises ``ValueError`` if the file cannot be found or resolved.
    """
    result = await file_system.get(path)
    if isinstance(result, dict) and "$error" in result:
        raise ValueError(f"Cannot resolve media file: {result['$error']}")

    # file_system.get returns a list of parts for binary files — take the first.
    if not result:
        raise ValueError(f"Empty file: \"{path}\"")

    part = result[0]
    if "inlineData" not in part:
        raise ValueError(
            f"File \"{path}\" is not a binary media file (got text)"
        )

    inline = part["inlineData"]
    return {
        "bytesBase64Encoded": inline["data"],
        "mimeType": inline["mimeType"],
    }


async def _resolve_media_inputs(
    options: dict[str, Any] | None,
    file_system: FileSystem,
) -> dict[str, Any]:
    """Resolve media file paths from options into Veo REST instance fields.

    Returns a dict of instance-level fields to merge into ``instances[0]``.
    """
    fields: dict[str, Any] = {}

    if not options:
        return fields

    # Starting frame (image-to-video).
    first_frame = options.get("first_frame")
    if first_frame:
        part = await _resolve_file_to_veo_media(first_frame, file_system)
        fields["image"] = part

    # Ending frame (interpolation).
    last_frame = options.get("last_frame")
    if last_frame:
        part = await _resolve_file_to_veo_media(last_frame, file_system)
        fields["lastFrame"] = part

    # Video continuation/extension — requires server-side URI, not inline
    # bytes. The Veo API only accepts previously generated video references.
    extend_video = options.get("extend_video")
    if extend_video:
        # Derive the sidecar path: e.g. "clip/video_0.mp4" → "clip/video_0.uri.json"
        uri_sidecar = extend_video.rsplit(".", 1)[0] + ".uri.json"
        uri_data = await file_system.get(uri_sidecar)

        # file_system.get returns a list with a text part for text files.
        uri_str = None
        if isinstance(uri_data, list) and uri_data:
            first_part = uri_data[0]
            if isinstance(first_part, dict) and "text" in first_part:
                try:
                    sidecar = json.loads(first_part["text"])
                    uri_str = sidecar.get("uri")
                except (json.JSONDecodeError, AttributeError):
                    pass

        if not uri_str:
            raise ValueError(
                f"Cannot extend video \"{extend_video}\": no server-side "
                f"URI sidecar found at \"{uri_sidecar}\". Video extension "
                f"requires a video from a previous Veo generation."
            )

        fields["video"] = {"uri": uri_str}

    # Reference images (up to 3 style/content guides).
    reference_paths = options.get("reference_images")
    if reference_paths and isinstance(reference_paths, list):
        refs = []
        for ref_path in reference_paths[:3]:
            part = await _resolve_file_to_veo_media(ref_path, file_system)
            refs.append({
                "image": part,
                "referenceType": "asset",
            })
        if refs:
            fields["referenceImages"] = refs

    return fields


class VideoAdapter:
    """Adapter for direct video generation via Veo REST API.

    Supports:
    - Runtime configuration via ``options`` (aspect_ratio, resolution,
      duration_seconds, person_generation).
    - Video continuation/extension via ``extend_video`` option.
    - Keyframe interpolation via ``first_frame`` / ``last_frame`` options.
    - Reference image direction via ``reference_images`` option (up to 3).
    - Persistent polling resumption via ``polling_state.json`` sidecar.
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
        # 1. Extract text prompt from segments / objective.md
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
            raise ValueError(
                "Direct video generation failed: Empty prompt / objective"
            )

        # 2. Resolve pidgin references (text only for prompt string).
        translated = await from_pidgin_string(prompt, config.file_system)
        if isinstance(translated, dict) and "$error" in translated:
            raise ValueError(translated["$error"])

        prompt_str = ""
        if isinstance(translated, dict):
            parts = translated.get("parts", [])
            prompt_str = "".join(
                p.get("text", "") for p in parts if "text" in p
            )
        elif isinstance(translated, str):
            prompt_str = translated

        resolved_model = config.model or "veo-3.1-generate-preview"

        # 3. Build parameters and resolve media inputs from options.
        parameters = _build_parameters(options)
        media_fields = await _resolve_media_inputs(
            options, config.file_system,
        )

        # Extension constraint: force resolution to 720p (Veo requirement).
        if "video" in media_fields:
            parameters["resolution"] = "720p"

        # 4. Assemble the Veo REST request body.
        instance: dict[str, Any] = {"prompt": prompt_str}
        instance.update(media_fields)

        body: dict[str, Any] = {
            "instances": [instance],
            "parameters": parameters,
        }

        send_request_event = {
            "sendRequest": {
                "body": {
                    "model": resolved_model,
                    "instances": body["instances"],
                    "parameters": body["parameters"],
                }
            }
        }
        await log_event(send_request_event)

        # 5. Persistent polling state sidecar for crash recovery.
        state_file = (
            config.ticket_dir / "polling_state.json"
            if config.ticket_dir
            else None
        )
        operation_name = None

        # Check if resumption sidecar exists to resume polling directly.
        if state_file and state_file.is_file():
            try:
                sdata = json.loads(
                    state_file.read_text(encoding="utf-8")
                )
                operation_name = sdata.get("operation_name")
                if operation_name:
                    await log_event({
                        "systemMessage": {
                            "text": (
                                "Resuming polling for active operation "
                                f"{operation_name}"
                            ),
                        }
                    })
            except Exception:
                pass  # File unreadable, fallback to fresh generation

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(300.0),
        ) as client:
            video_uri = None
            err_msg = ""

            while True:
                # Fresh generation path if no active operation_name.
                if not operation_name:
                    start_url = (
                        "https://generativelanguage.googleapis.com/v1beta"
                        f"/models/{resolved_model}:predictLongRunning"
                        f"?key={api_key}"
                    )
                    res = await client.post(
                        start_url,
                        json=body,
                        headers={"Content-Type": "application/json"},
                    )
                    if res.status_code != 200:
                        err_msg = (
                            f"Veo video generation failed "
                            f"({res.status_code}): {res.text}"
                        )
                        expanded = expand_veo_error(err_msg, resolved_model)
                        raise VeoGenerationError(err_msg, expanded)
                    data = res.json()

                    operation_name = data.get("name")
                    if not operation_name:
                        raise ValueError(
                            "No operation name returned from Veo "
                            "video generation"
                        )

                    await log_event({
                        "systemMessage": {
                            "text": (
                                "Initiated polling for active operation "
                                f"{operation_name}"
                            ),
                        }
                    })

                    # Persist operation name immediately to sidecar.
                    if state_file:
                        try:
                            state_file.write_text(
                                json.dumps(
                                    {"operation_name": operation_name}
                                ),
                                encoding="utf-8",
                            )
                        except Exception:
                            pass

                # Polling loop with self-healing fallback.
                poll_url = (
                    "https://generativelanguage.googleapis.com/v1beta"
                    f"/{operation_name}?key={api_key}"
                )
                polling_failed = False

                while True:
                    await log_event({
                        "systemMessage": {
                            "text": (
                                f"Polling operation {operation_name}..."
                            ),
                        }
                    })
                    poll_res = await client.get(poll_url)
                    if poll_res.status_code != 200:
                        err_msg = (
                            f"Veo operation polling failed "
                            f"({poll_res.status_code}): {poll_res.text}"
                        )
                        polling_failed = True
                        break

                    poll_data = poll_res.json()
                    if "error" in poll_data:
                        err_obj = poll_data["error"]
                        err_msg = err_obj.get(
                            "message", json.dumps(err_obj)
                        )
                        polling_failed = True
                        break

                    if poll_data.get("done"):
                        try:
                            video_uri = (
                                poll_data["response"]
                                ["generateVideoResponse"]
                                ["generatedSamples"][0]
                                ["video"]["uri"]
                            )
                        except (KeyError, IndexError, TypeError):
                            raise ValueError(
                                "Malformed Veo completion response: "
                                f"{json.dumps(poll_data)}"
                            )
                        break

                    await asyncio.sleep(5.0)

                # Intercept polling failure for self-healing fallback.
                if polling_failed:
                    if state_file and state_file.exists():
                        state_file.unlink(missing_ok=True)
                        await log_event({
                            "systemMessage": {
                                "text": (
                                    "Polling unrecoverable for "
                                    f"{operation_name}. Falling back to "
                                    "fresh video generation."
                                ),
                            }
                        })
                        operation_name = None
                        continue

                    # Fresh generation failed during polling → fatal error.
                    expanded = expand_veo_error(err_msg, resolved_model)
                    raise VeoGenerationError(err_msg, expanded)

                # Polling successful.
                break

            # 6. Download binary final video deliverable.
            video_res = await client.get(
                video_uri,
                headers={"x-goog-api-key": api_key},
                follow_redirects=True,
            )
            if video_res.status_code != 200:
                raise ValueError(
                    f"Failed to download generated video "
                    f"({video_res.status_code}): {video_res.text}"
                )
            raw_bytes = video_res.content

            # Clean up persistence sidecar upon success.
            if state_file and state_file.exists():
                state_file.unlink(missing_ok=True)

        encoded_data = base64.b64encode(raw_bytes).decode("ascii")
        part = {
            "inlineData": {
                "mimeType": "video/mp4",
                "data": encoded_data,
            }
        }

        file_name = f"{slug}/video_0.mp4" if slug else "video_0.mp4"
        saved_path = config.file_system.add_part(part, file_name=file_name)
        if isinstance(saved_path, dict) and "$error" in saved_path:
            raise ValueError(saved_path["$error"])

        # Persist the Veo server-side URI as a sidecar file for future
        # extension requests. The URI is valid for 2 days and resets on use.
        uri_sidecar_name = (
            f"{slug}/video_0.uri.json" if slug else "video_0.uri.json"
        )
        uri_sidecar_content = json.dumps({"uri": video_uri})
        config.file_system.write(uri_sidecar_name, uri_sidecar_content)

        complete_event = {
            "complete": {
                "result": {
                    "success": True,
                    "outcomes": {
                        "parts": [
                            {"text": f"Result written to {file_name}"}
                        ]
                    },
                    "intermediate": [
                        {
                            "path": file_name,
                            "content": part,
                        }
                    ],
                }
            }
        }
        await log_event(complete_event)

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

from typing import Any, Callable

from bees.pidgin import from_pidgin_string
from bees.protocols.session import SessionConfiguration
from opal_backend.gemini_client import stream_generate_content
from opal_backend.local.backend_client_impl import HttpBackendClient


class TextAdapter:
    """Adapter for direct text generation."""

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
            raise ValueError("Direct model generation failed: Empty prompt / objective")

        # Translate pidgin references (resolving files)
        translated = await from_pidgin_string(prompt, config.file_system)
        if isinstance(translated, dict) and "$error" in translated:
            raise ValueError(translated["$error"])

        # Resolve model configuration
        model = config.model or "gemini-3-flash-preview"
        if model == "pro":
            resolved_model = "gemini-3.1-pro-preview"
        elif model == "flash":
            resolved_model = "gemini-3-flash-preview"
        elif model == "lite":
            resolved_model = "gemini-2.5-flash-lite"
        else:
            resolved_model = model

        # Setup generation configuration
        generation_config: dict[str, Any] = {}
        if "pro" in resolved_model:
            generation_config["thinkingConfig"] = {
                "includeThoughts": True,
                "thinkingLevel": "high",
            }

        # System instructions to enforce clean direct formatting
        DEFAULT_SYSTEM_INSTRUCTION = {
            "parts": [
                {
                    "text": (
                        "You are working as part of an AI system, so no chit-chat "
                        "and no explaining what you're doing and why.\n"
                        'DO NOT start with "Okay", or "Alright" or any preambles. '
                        "Just the output, please."
                    )
                }
            ],
            "role": "user",
        }

        body: dict[str, Any] = {
            "systemInstruction": DEFAULT_SYSTEM_INSTRUCTION,
            "contents": [translated],
            "generationConfig": generation_config,
        }

        # Log the starting sendRequest event to events.jsonl for Hivetool telemetry
        send_request_event = {
            "sendRequest": {
                "body": {
                    "model": resolved_model,
                    "contents": [translated],
                    "generationConfig": generation_config,
                }
            }
        }
        await log_event(send_request_event)

        # Grounding tools integration based on builtin capability names
        tools: list[dict[str, Any]] = []
        if config.function_filter:
            if "builtin.search_grounding" in config.function_filter:
                tools.append({"googleSearch": {}})
            if "builtin.maps_grounding" in config.function_filter:
                tools.append({"googleMaps": {}})
            if "builtin.url_context" in config.function_filter:
                tools.append({"urlContext": {}})

        if tools:
            body["tools"] = tools

            # Update logged sendRequest tools list to match
            send_request_event["sendRequest"]["body"]["tools"] = tools

        result_parts: list[dict[str, Any]] = []

        async for chunk in stream_generate_content(
            resolved_model, body, backend=backend
        ):
            candidates = chunk.get("candidates", [])
            if not candidates:
                continue
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                if not part:
                    continue
                if "text" in part:
                    if part.get("thought"):
                        await log_event({"thought": {"text": part["text"]}})
                    else:
                        result_parts.append(part)

        from bees.pidgin import merge_text_parts
        merged = merge_text_parts(result_parts, separator="")
        final_text = "".join(p["text"] for p in merged if "text" in p)

        if not final_text:
            raise ValueError("No text was generated. Please try again")

        # Resolve the sandboxed workspace write path
        output_path = f"{slug}/text.md" if slug else "text.md"
        config.file_system.write(output_path, final_text)

        # Yield standard successful completion event
        complete_event = {
            "complete": {
                "result": {
                    "success": True,
                    "outcomes": {
                        "parts": [{"text": f"Result written to {output_path}"}]
                    },
                    "intermediate": [
                        {
                            "path": output_path,
                            "content": {"text": final_text}
                        }
                    ]
                }
            }
        }
        await log_event(complete_event)

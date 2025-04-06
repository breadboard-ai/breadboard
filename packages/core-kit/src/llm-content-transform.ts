/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";

export { llmContentTransform };

type StreamType = "sse" | "text" | "json";

function makePart(stream: Omit<StreamType, "sse">, chunk: string): DataPart {
  if (stream === "text") {
    return { text: chunk };
  } else {
    try {
      return { json: JSON.parse(chunk) };
    } catch (e) {
      return { json: JSON.stringify(chunk) };
    }
  }
}

function llmContentTransform(
  stream: StreamType
): TransformStream<string, LLMContent> {
  if (stream === "sse") throw new Error("Only text and json supported");
  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue({
        parts: [makePart(stream, chunk)],
      });
    },
  });
}

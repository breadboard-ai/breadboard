/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";

export { llmContentTransform };

function llmContentTransform(
  stream: "sse" | "text" | "json"
): TransformStream<string, LLMContent> {
  if (stream !== "text") throw new Error("Only text supported");
  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue({
        parts: [{ text: chunk }],
      });
    },
  });
}

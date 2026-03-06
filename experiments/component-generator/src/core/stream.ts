/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SSE stream reader for the Gemini proxy.
 *
 * Reads a streaming response, accumulating model thoughts (displayed
 * in real-time via a callback) and regular text output.
 */

import { debugLog } from "../debug.js";

export { readSSEStream, type StreamResult };

interface StreamResult {
  thoughts: string;
  text: string;
}

/**
 * Read an SSE stream from the Gemini proxy, accumulating thoughts and text.
 * Calls `onThought` in real-time as thought chunks arrive.
 */
async function readSSEStream(
  response: Response,
  onThought: (thoughts: string) => void
): Promise<StreamResult> {
  const reader = response.body?.getReader();
  if (!reader) return { thoughts: "", text: "" };

  const decoder = new TextDecoder();
  let buffer = "";
  let thoughts = "";
  let text = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process all complete SSE events in the buffer.
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const data = event
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("");

      if (!data || data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data);
        const candidates = chunk.candidates ?? [];

        for (const candidate of candidates) {
          for (const part of candidate.content?.parts ?? []) {
            if (part.thought && part.text) {
              // This is a thought — accumulate and display live.
              thoughts += part.text;
              onThought(thoughts);
            } else if (part.text) {
              // This is regular output.
              text += part.text;
            }
          }
        }

        debugLog.add("sse-chunk", chunk);
      } catch {
        // Malformed chunk — skip.
      }
    }
  }

  return { thoughts, text };
}

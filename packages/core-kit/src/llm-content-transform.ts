/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPart, LLMContent } from "@breadboard-ai/types";
import { chunkRepairTransform } from "@google-labs/breadboard/remote";

export { llmContentTransform };

type StreamType = "sse" | "text" | "json";

function makePart(stream: Omit<StreamType, "sse">, chunk: string): DataPart {
  if (stream === "text") {
    return { text: chunk };
  } else {
    try {
      return { json: JSON.parse(chunk) };
    } catch (e) {
      return { text: chunk };
    }
  }
}

type ServerSentEvent = {
  event: string;
  data: string;
  id: string | null;
  retry: number | null;
};

function sseTransform() {
  const chunkRepair = chunkRepairTransform();
  const sse = new TransformStream<string, LLMContent>({
    transform(chunk, controller) {
      if (typeof chunk !== "string") {
        controller.error(new TypeError("Input chunk must be a string."));
        return;
      }

      const message = chunk.trim();
      if (!message) {
        return;
      }

      const event: ServerSentEvent = {
        event: "message",
        data: "",
        id: null,
        retry: null,
      };
      const dataLines = [];

      const lines = message.split("\n");
      for (const line of lines) {
        if (!line || line.startsWith(":")) {
          // Ignore empty lines and comments
          continue;
        }

        const colonIndex = line.indexOf(":");
        let field = "";
        let value = "";

        if (colonIndex === 0) {
          // Line starts with ':', treat as comment (some interpretations)
          continue;
        } else if (colonIndex > 0) {
          field = line.substring(0, colonIndex);
          value = line.substring(colonIndex + 1);
          if (value.startsWith(" ")) {
            value = value.substring(1);
          }
        } else {
          // Ignore lines without colons that aren't comments.
          continue;
        }

        switch (field) {
          case "event":
            event.event = value;
            break;
          case "data":
            dataLines.push(value); // Collect data lines
            break;
          case "id":
            // SSE spec: "The value must not contain U+0000 NULL characters."
            if (!value.includes("\u0000")) {
              event.id = value;
            }
            break;
          case "retry": {
            const retryValue = parseInt(value, 10);
            // Check if it's a non-negative integer
            if (!isNaN(retryValue) && retryValue >= 0) {
              event.retry = retryValue;
            }
            break;
          }
          default:
            console.log(`Ignoring unknown SSE field: ${field}`);
            break;
        }
      }
      event.data = dataLines.join("\n");
      try {
        event.data = JSON.parse(event.data);
      } catch (e) {
        // eat the error, do nothing.
      }

      controller.enqueue({ parts: [{ json: event }] });
    },
  });
  chunkRepair.readable.pipeTo(sse.writable);

  return {
    writable: chunkRepair.writable,
    readable: sse.readable,
  };
}

function llmContentTransform(
  stream: StreamType
): TransformStream<string, LLMContent> {
  if (stream === "sse") return sseTransform();
  return new TransformStream({
    transform(chunk, controller) {
      controller.enqueue({
        parts: [makePart(stream, chunk)],
      });
    },
  });
}

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { chunkRepairTransform } from "../new/chunk-repair";
import { serverStreamEventDecoder } from "./stream";
import { LLMContent, RunEvent } from "./types";

const BOARD_API_ENDPOINT =
  "https://breadboard.live/boards/@dimitri/children-story-teller-prod.bgl.api/run";

const BOARD_SERVER_API_KEY = process.env.BOARD_SERVER_API_KEY;

export function toText(context: LLMContent[], defaultText: string): string {
  const last = context.filter((item) => item.role === "model").at(-1);
  if (!last) {
    return defaultText;
  }
  const text = last.parts
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
  if (!text) {
    return defaultText;
  }
  return text;
}

export async function generateStory(
  topic: string
): Promise<ReadableStream<RunEvent>> {
  const request = new Request(BOARD_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      $key: BOARD_SERVER_API_KEY,
      topic,
    }),
  });

  const response = await fetch(request);
  if (!response.ok) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue([
          "error",
          `${response.status} ${response.statusText}`,
        ]);
        controller.close();
      },
    });
  }

  if (!response.body) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(["error", "No response body"]);
        controller.close();
      },
    });
  }

  return response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(chunkRepairTransform())
    .pipeThrough(serverStreamEventDecoder())
    .pipeThrough(runEventDecoder());
}

function runEventDecoder() {
  return new TransformStream<string, RunEvent>({
    transform(chunk, controller) {
      try {
        controller.enqueue(JSON.parse(chunk));
      } catch (e) {
        controller.enqueue(["error", "Invalid JSON"]);
      }
    },
  });
}

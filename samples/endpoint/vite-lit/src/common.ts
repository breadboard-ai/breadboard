/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InspectorRequestEvent,
  InspectorRequestType,
  InspectorResponseEvent,
  RunEvent,
  RunRequestBody,
  Schema,
  SettingsData,
} from "./types";

export function createRequestEvent(
  type: InspectorRequestType,
  settings: SettingsData,
  inputs?: Record<string, unknown>,
  next?: string
): InspectorRequestEvent {
  const { key, url } = settings;
  const body: RunRequestBody = {
    $key: key,
    ...inputs,
  };
  if (next) {
    body.$next = next;
  }
  return {
    type: "request",
    request: {
      method: "POST",
      url: toEndpointURL(url, type),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  };
}

// Make a request to the board API endpoint.
export async function makeRunRequest(
  event: InspectorRequestEvent
): Promise<InspectorResponseEvent> {
  const result: InspectorResponseEvent = {
    type: "response",
    response: {
      status: 0,
      statusText: "",
      events: [],
    },
  };
  try {
    const { url } = event.request;
    const response = await fetch(url, event.request);

    result.response.status = response.status;
    result.response.statusText = response.statusText;
    const data = await response.text();

    try {
      const lines = data.split("\n\n");
      const events = lines
        .map((line) => line.replace("data:", "").trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line)) as RunEvent[];
      result.response.events = events;
      return result;
    } catch (e) {
      result.response.events = [
        ["error", `${(e as Error).message}\n\n${data}`],
      ];
      return result;
    }
  } catch (e) {
    result.response.statusText = (e as Error).message;
    return result;
  }
}

function toEndpointURL(url: string, type: InspectorRequestType): string {
  if (type === "run") {
    return url.replace(/.bgl.json$/, ".bgl.api/run");
  } else {
    return url.replace(/.bgl.json$/, ".bgl.api/invoke");
  }
}

export function isStringSchema(schema: Schema): boolean {
  return schema && schema.type === "string";
}

export function isLLMContentSchema(schema: Schema): boolean {
  return !!(
    schema &&
    schema.type === "object" &&
    schema.behavior &&
    schema.behavior.includes("llm-content")
  );
}

export function isLLMContentArraySchema(schema: Schema): boolean {
  return !!(
    schema &&
    schema.type === "array" &&
    schema.items &&
    !Array.isArray(schema.items) &&
    isLLMContentSchema(schema.items)
  );
}

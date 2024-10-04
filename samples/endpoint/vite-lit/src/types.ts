/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type SettingsData = {
  url: string;
  key: string;
};

export type InspectorEvent = InspectorResponseEvent | InspectorRequestEvent;

export type InspectorRequestEvent = {
  type: "request";
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
};

export type InspectorRequestType = "run" | "invoke";

export type InspectorResponseEvent = {
  type: "response";
  response: {
    status: number;
    statusText: string;
    events: RunEvent[];
  };
};

/**
 * Represents a run event.
 * See https://breadboard-ai.github.io/breadboard/docs/reference/board-run-api-endpoint/#response-1
 */
export type RunEvent = RunInputEvent | RunOutputEvent | RunErrorEvent;

export type RunInputEvent = [
  "input",
  {
    node: {
      id: string;
    };
    inputArguments: {
      schema: {
        properties: Record<string, unknown>;
      };
    };
  },
  next: string,
];

export type RunOutputEvent = [
  "output",
  {
    node: {
      id: string;
    };
    outputs: Record<string, unknown>;
  },
  next: string,
];

export type RunErrorEvent = ["error", message: string];

export type RunRequestBody = {
  $key: string;
  $next?: string;
} & Record<string, unknown>;

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeHandlerObject } from "@google-labs/breadboard";

export default {
  metadata: {
    title: "Run Module",
    description: "Runs a supplied ECMAScript module.",
    tags: ["experimental"],
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-runmodule-component",
    },
  },
  async describe() {
    return {
      inputSchema: {
        type: "object",
        properties: {
          $inputSchema: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
            title: "Input Schema",
            description:
              "The schema that defines the shape of the input argument object.",
            behavior: ["config", "ports-spec"],
          },
          $module: {
            type: "string",
            title: "Module",
            description: "The Module to run.",
            behavior: ["config", "module"],
          },
          $outputSchema: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: true,
            title: "Output Schema",
            description:
              "The schema of the output data, which defines the shape of the return value.",
            behavior: ["config", "ports-spec"],
          },
        },
        required: ["$module"],
        additionalProperties: true,
      },
      outputSchema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
      },
    };
  },
  invoke: async () => {
    if (typeof globalThis.window === "undefined") {
      return error(
        "The `runModule` component currently only works in the browser."
      );
    }
    return error("Run Module implementation is not available");
  },
} satisfies NodeHandlerObject;

function error($error: string) {
  return { $error };
}

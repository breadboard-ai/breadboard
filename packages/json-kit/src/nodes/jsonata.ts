/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";
import { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import jsonata from "jsonata";

export default defineNodeType({
  name: "jsonata",
  metadata: {
    title: "JSONata",
    description:
      'Uses JSONata (a kind of "SQL for JSON") to transform incoming JSON object. See https://jsonata.org/ for details on the language.',
  },
  inputs: {
    expression: {
      title: "Expression",
      behavior: ["config"],
      description: "The Jsonata expression to evaluate",
      type: "string",
    },
    raw: {
      title: "Raw",
      behavior: ["config"],
      description:
        "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
      type: "boolean",
      default: false,
    },
    json: {
      title: "JSON",
      description:
        "The JSON object to evaluate. If not set, dynamically wired input ports act as the properties of a JSON object.",
      type: "unknown",
      optional: true,
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  describe: async ({ expression, raw, json }, rest) => ({
    // Extra properties are allowed only if json is undefined.
    inputs: json === undefined ? { "*": {} } : {},
    outputs: raw
      ? // When raw, we assume that the jsonata expression returns an object,
        // and update the output schema with any properties we detect on that
        // object. That's not exhaustive, though, so we also still include "*"
        // to indicate that there could be additional properties we didn't
        // detect with the current particular value.
        { ...(await detectOutputProperties(expression, json, rest)), "*": {} }
      : // When not raw, the result goes to the result port, and there won't be
        // any other outputs.
        {
          result: {
            title: "Result",
            description: "The result of the Jsonata expression",
          },
        },
  }),
  invoke: async ({ expression, raw, json }, rest) => {
    if (!expression) {
      // TODO(aomarks) We shouldn't need this if we ensure that invoke isn't
      // called unless all required properties are set.
      return { $error: "Jsonata node requires `expression` input" };
    }
    // TODO(aomarks) Error if both json and rest are set.
    const result: JsonSerializable = await jsonata(expression).evaluate(
      json ?? rest
    );
    if (raw) {
      if (typeof result !== "object" || result === null) {
        return {
          $error:
            "jsonata node in raw mode but expression did not return an object",
        };
      }
      return result;
    }
    return { result };
  },
});

async function detectOutputProperties(
  expression: string | undefined,
  json: JsonSerializable | undefined,
  rest: Record<string, JsonSerializable>
) {
  if (!expression) {
    return {};
  }
  let result;
  try {
    result = await jsonata(expression).evaluate(json ?? rest);
  } catch {
    return {};
  }
  if (typeof result !== "object" || result === null) {
    return {};
  }
  return Object.fromEntries(Object.keys(result).map((name) => [name, {}]));
}

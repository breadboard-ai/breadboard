/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeDescriberFunction,
  NodeHandlerFunction,
  NodeHandlerContext,
  Schema,
  NodeHandler,
} from "@google-labs/breadboard";

import jsonata from "jsonata";

export type JsonataOutputs = Record<string, unknown> & {
  result: unknown;
};

export type JsonataInputs = {
  expression: string;
  raw: boolean;
  json?: unknown;
};

export const jsonataHandler: NodeHandlerFunction = async (
  inputs: InputValues
) => {
  const { expression, raw, ...rest } = inputs as JsonataInputs;
  if (!expression) throw new Error("Jsonata node requires `expression` input");
  const json = rest.json || rest;
  const result = await jsonata(expression).evaluate(json);
  return raw ? result : { result };
};

export const computeOutputSchema = async (
  inputs: InputValues
): Promise<Schema> => {
  if (!inputs || !inputs.raw) {
    return {
      type: "object",
      properties: {
        result: {
          title: "result",
          description: "The result of the Jsonata expression",
          type: "string",
        },
      },
      required: ["result"],
    };
  }

  try {
    const result = await jsonataHandler(inputs, {} as NodeHandlerContext);
    if (!result) return {};
    const properties: Schema["properties"] = {};
    const outputSchema = {
      type: "object",
      properties,
      additionalProperties: false,
    };
    Object.entries(result).forEach(([key, value]) => {
      properties[key] = {
        type: typeof value,
        title: key,
      };
    });
    return outputSchema;
  } catch (e) {
    return {
      type: "object",
      additionalProperties: false,
      properties: {},
    };
  }
};

export const jsonataDescriber: NodeDescriberFunction = async (
  inputs?: InputValues
) => {
  const outputSchema = await computeOutputSchema(inputs || {});
  return {
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          title: "expression",
          description: "The Jsonata expression to evaluate",
          type: "string",
        },
        raw: {
          title: "raw",
          description:
            "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
          type: "boolean",
        },
        json: {
          title: "json",
          description: "The JSON object to evaluate",
          type: ["object", "string"],
        },
      },
      required: ["expression"],
    },
    outputSchema,
  };
};

export default {
  describe: jsonataDescriber,
  invoke: jsonataHandler,
} satisfies NodeHandler;

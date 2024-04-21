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
  SchemaBuilder,
  NodeHandlerObject,
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
      properties: {},
    };
  }
};

export const jsonataDescriber: NodeDescriberFunction = async (
  inputs?: InputValues,
  inputSchema?: Schema
) => {
  const outputSchema = await computeOutputSchema(inputs || {});
  return {
    inputSchema: new SchemaBuilder()
      .addProperties({
        expression: {
          title: "expression",
          behavior: ["config"],
          description: "The Jsonata expression to evaluate",
          type: "string",
        },
        raw: {
          title: "raw",
          behavior: ["config"],
          description:
            "Whether or not to return use the evaluation result as raw output (true) or as a port called `result` (false). Default is false.",
          type: "boolean",
        },
        json: {
          title: "json",
          description: "The JSON object to evaluate",
          type: ["object", "string"],
        },
      })
      .addRequired("expression")
      .addProperties(inputSchema?.properties)
      .build(),
    outputSchema,
  };
};

export default {
  metadata: {
    title: "JSONata",
    description:
      "Uses JSONata (a kind of SQL for JSON) to transform incoming JSON object. See https://jsonata.org/ for details on the language.",
  },
  describe: jsonataDescriber,
  invoke: jsonataHandler,
} satisfies NodeHandlerObject;

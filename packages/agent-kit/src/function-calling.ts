/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { code } from "@google-labs/breadboard";
import { ContextItem, FunctionCallPart } from "./context.js";

export const functionCallOrText = code(({ context }) => {
  if (!context) throw new Error("Context is a required input");
  const item = context as ContextItem;
  const part = item.parts[0];
  console.assert(
    item.parts.length === 1,
    "Only one part is expected in Gemini response"
  );
  if ("text" in part) {
    return { context, text: part.text };
  }
  return { context, functionCall: part.functionCall };
});

type URLMap = Record<string, string>;

export const boardInvokeAssembler = code(({ functionCall, urlMap }) => {
  if (!functionCall) throw new Error("Function call is a required input");
  if (!urlMap) throw new Error("URL map is a required input");
  const call = functionCall as FunctionCallPart["functionCall"];
  const $board = (urlMap as URLMap)[call.name];
  // This is a hack that is only needed because we currently invoke older-style
  // boards that ask for a generator URL (math and search-summarizer)
  // TODO: Remove this expectation and this hack.
  const generator =
    "https://raw.githubusercontent.com/breadboard-ai/breadboard/05136f811e443dd931a2a2a40ff5a3f388d5ce75/packages/breadboard-web/public/graphs/gemini-generator.json";
  return { $board, generator, ...call.args };
});

export type FunctionResponse = {
  role: "function";
  parts: { functionResponse: { name: string; response: unknown }[] }[];
};

export const boardResponseExtractor = code((inputs) => {
  // Pluck out schema from inputs
  // See https://github.com/breadboard-ai/breadboard/issues/924
  const { schema, ...response } = inputs;
  schema;
  return { response };
});

export const functionResponseFormatter = code(
  ({ context, generated, functionCall, response }) => {
    const call = functionCall as FunctionCallPart["functionCall"];
    return {
      context: [
        ...(context as ContextItem[]),
        generated,
        {
          role: "function",
          parts: [{ functionResponse: { name: call.name, response } }],
        },
      ],
    };
  }
);

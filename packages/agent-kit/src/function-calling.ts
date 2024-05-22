/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, Schema, board, code } from "@google-labs/breadboard";
import { LlmContent, FunctionCallPart, fun, TextPart } from "./context.js";
import { core } from "@google-labs/core-kit";

export const functionOrTextRouterFunction = fun(({ context }) => {
  if (!context) throw new Error("Context is a required input");
  const item = context as LlmContent;
  const functionCallPart = item.parts.find(
    (part) => "functionCall" in part
  ) as FunctionCallPart;
  if (!functionCallPart) {
    const textPart = item.parts.find((part) => "text" in part) as TextPart;
    if (!textPart) throw new Error("No text or function call found in context");
    return { context, text: textPart.text };
  }
  return { context, functionCall: functionCallPart.functionCall };
});

export const functionOrTextRouter = code(functionOrTextRouterFunction);

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
        ...(context as LlmContent[]),
        generated,
        {
          role: "function",
          parts: [{ functionResponse: { name: call.name, response } }],
        },
      ],
    };
  }
);

export const functionSignatureFromBoardFunction = fun(({ board }) => {
  const b = board as GraphDescriptor;
  const inputs = b.nodes.filter((node) => node.type === "input");
  if (inputs.length === 0) {
    throw new Error("No inputs found");
  }
  const outputs = b.nodes.filter((node) => node.type === "output");
  if (outputs.length === 0) {
    throw new Error("No outputs found");
  }
  // For now, only support one input/output.
  // TODO: Implement support for multiple inputs/outputs.
  const inputSchema = inputs[0].configuration?.schema as Schema;
  if (!inputSchema) {
    throw new Error("No input schema found");
  }
  const outputSchema = outputs[0].configuration?.schema as Schema;
  if (!outputSchema) {
    throw new Error("No output schema found");
  }
  const properties: Record<string, Schema> = {};
  for (const key in inputSchema.properties) {
    const property = inputSchema.properties[key];
    const type =
      property.type == "object" || property.type == "array"
        ? "string"
        : property.type;
    properties[key] = {
      type,
      description: property.description || property.title || "text",
    };
  }
  const name = b.title?.replace(/\W/g, "_");
  const description = b.description;
  const parameters = {
    type: "object",
    properties,
  };
  return { function: { name, description, parameters }, returns: outputSchema };
});

export const functionSignatureFromBoard = code(
  functionSignatureFromBoardFunction
);

export const boardToFunction = await board(({ item }) => {
  const url = item.isString();

  const importBoard = core.curry({
    $board: url,
  });

  const getFunctionSignature = functionSignatureFromBoard({
    $metadata: { title: "Get Function Signature from board" },
    board: importBoard.board,
  });

  return { function: getFunctionSignature.function, boardURL: url };
}).serialize({
  title: "Board to functions",
  description:
    "Use this board to convert specified boards into function-calling signatures",
});

type FunctionSignatureItem = {
  function: { name: string };
  boardURL: string;
};

export const functionDeclarationsFormatter = code(({ list }) => {
  const tools: unknown[] = [];
  const urlMap: Record<string, string> = {};
  (list as FunctionSignatureItem[]).forEach((item) => {
    tools.push(item.function);
    urlMap[item.function.name] = item.boardURL;
  });
  return { tools, urlMap };
});

export const toolResponseFormatter = code((inputs) => {
  for (const key in inputs) {
    const input = inputs[key] as LlmContent;
    if ("content" in input) {
      // Presume that this is an LLMContent
      const content = input.content as LlmContent;
      // Let's double check...
      if (content.parts && Array.isArray(content.parts)) {
        content.role = "tool";
        return { response: content };
      }
    }
  }
  const text = JSON.stringify(inputs);
  return { response: { parts: [{ text }], role: "tool" } satisfies LlmContent };
});

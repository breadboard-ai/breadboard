/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues, board, code } from "@google-labs/breadboard";
import { LlmContent, FunctionCallPart, fun, TextPart } from "./context.js";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";

export const functionOrTextRouterFunction = fun(({ context }) => {
  if (!context) throw new Error("Context is a required input");
  const item = context as LlmContent;
  const functionCallParts = item.parts
    .filter((part) => "functionCall" in part)
    .map((part) => (part as FunctionCallPart).functionCall);
  if (functionCallParts.length === 0) {
    const textPart = item.parts.find((part) => "text" in part) as TextPart;
    if (!textPart) throw new Error("No text or function call found in context");
    return { context, text: textPart.text };
  }
  return { context, functionCalls: functionCallParts };
});

export const functionOrTextRouter = code(functionOrTextRouterFunction);

export type URLMap = Record<string, string>;

export type BoardInvocationArgs = {
  $board: string;
} & Record<string, unknown>;

export const boardInvocationAssemblerFunction = fun(
  ({ functionCalls, urlMap }) => {
    if (!functionCalls) {
      throw new Error("Function call array is a required input");
    }
    if (!urlMap) {
      throw new Error("URL map is a required input");
    }
    const calls = functionCalls as FunctionCallPart["functionCall"][];
    if (calls.length === 0) {
      throw new Error("Function call array must not be empty.");
    }
    const list: BoardInvocationArgs[] = [];
    for (const call of calls) {
      const $board = (urlMap as URLMap)[call.name];
      list.push({ $board, ...call.args });
    }
    return { list };
  }
);

export type FunctionResponse = {
  role: "function";
  parts: { functionResponse: { name: string; response: unknown }[] }[];
};
export const boardInvocationAssembler = code(boardInvocationAssemblerFunction);

const argsUnpacker = code(({ item }) => {
  const result = item as OutputValues;
  return result;
});

const resultPacker = code((result) => {
  return { item: result };
});

export const invokeBoardWithArgs = await board(({ item }) => {
  const unpackArgs = argsUnpacker({
    $metadata: {
      title: "Unpack args",
      description: "Unpacking board arguments",
    },
    item,
  });

  const invoker = core.invoke({
    $metadata: {
      title: "Invoke board",
      description: "Invoking the board with unpacked arguments",
    },
    ...unpackArgs,
  });

  const packResults = resultPacker({
    $metadata: { title: "Pack results", description: "Packing results" },
    ...invoker,
  });

  return { item: packResults.item };
}).serialize({
  title: "Invoke Board With Args",
  description:
    "Takes one item of `boardInvocationAssembler` output and invokes it as a board with arguments.",
  version: "0.0.1",
});

// TODO: Deprecate this. Only used by toolWorker. Remove when removing
// the toolWorker node.
export const boardInvokeAssembler = code(({ functionCalls, urlMap }) => {
  if (!functionCalls)
    throw new Error("Function call array is a required input");
  if (!urlMap) throw new Error("URL map is a required input");
  const calls = functionCalls as FunctionCallPart["functionCall"][];
  if (calls.length === 0)
    throw new Error("Function call array must not be empty.");
  const call = calls[0];
  const $board = (urlMap as URLMap)[call.name];
  // This is a hack that is only needed because we currently invoke older-style
  // boards that ask for a generator URL (math and search-summarizer)
  // TODO: Remove this expectation and this hack.
  const generator =
    "https://raw.githubusercontent.com/breadboard-ai/breadboard/05136f811e443dd931a2a2a40ff5a3f388d5ce75/packages/breadboard-web/public/graphs/gemini-generator.json";
  return { $board, generator, ...call.args };
});

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

export const boardToFunction = await board(({ item }) => {
  const url = item.isString();

  const importBoard = core.curry({
    $board: url,
  });

  // TODO: Convert to `code`.
  const getFunctionSignature = json.jsonata({
    $id: "getFunctionSignature",
    expression: `
      (
        $adjustType := function ($type) {
            $type = "object" or $type = "array" ? "string" : $type
        };

        {
        "function": {
            "name": $replace(title, /\\W/, "_"),
            "description": description,
            "parameters": {
                "type": "object",
                "properties": nodes[type="input"][0].configuration.schema.properties ~> $each(function($v, $k) {
                { $k: {
                    "type": $v.type ~> $adjustType,
                    "description": $v.description
                } }
                }) ~> $merge
            }
        },
        "returns": nodes[type="output"][0].configuration.schema ~> | ** | {}, 'title' |
        }
    )`,
    json: importBoard.board,
    raw: true,
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

export type ToolResponse = { item: Record<string, unknown> };

export const toolResponseFormatterFunction = fun(({ response }) => {
  const r = response as ToolResponse[];
  const result: LlmContent[] = [];
  for (const inputs of r) {
    let contentDetected = false;
    if (!inputs.item) {
      throw new Error("Invalid tool response");
    }
    for (const key in inputs.item) {
      const input = inputs.item[key] as { content: LlmContent };
      if (input !== null && typeof input === "object" && "content" in input) {
        // Presume that this is an LLMContent
        const content = input.content;
        // Let's double check...
        if (content.parts && Array.isArray(content.parts)) {
          content.role = "tool";
          result.push(content);
          contentDetected = true;
        }
      }
    }
    if (!contentDetected) {
      const text = JSON.stringify(inputs.item);
      result.push({ parts: [{ text }], role: "tool" } satisfies LlmContent);
    }
  }
  return { response: result };
});

export const toolResponseFormatter = code(toolResponseFormatterFunction);

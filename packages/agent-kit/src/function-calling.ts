/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  OutputValues,
  GraphDescriptor,
  Schema,
  board,
  code,
} from "@google-labs/breadboard";
import {
  LlmContent,
  FunctionCallPart,
  fun,
  TextPart,
  Context,
} from "./context.js";
import { core } from "@google-labs/core-kit";

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

export type URLMap = Record<
  string,
  {
    url: string;
    flags: FunctionCallFlags;
  }
>;

export type BoardInvocationArgs = {
  $board: string;
  $flags: FunctionCallFlags;
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
      const item = (urlMap as URLMap)[call.name];
      const $board = item.url;
      const $flags = item.flags;
      const llmContentProperty =
        $flags.inputLLMContent || $flags.inputLLMContentArray;
      const invokeArgs: BoardInvocationArgs = { $board, $flags, ...call.args };
      if (llmContentProperty) {
        // convert args into LLMContent.
        const args = call.args as OutputValues;
        const text = args[llmContentProperty] as string;
        const parts = [{ text }];
        const llmContent: LlmContent = { parts, role: "user" };
        if ($flags.inputLLMContentArray) {
          invokeArgs[llmContentProperty] = [llmContent];
        } else {
          invokeArgs[llmContentProperty] = llmContent;
        }
      }
      list.push(invokeArgs);
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $flags, ...result } = item as OutputValues;
  return result;
});

const resultPacker = code((result) => {
  return { result };
});

const flagGetter = code(({ item }) => {
  const { $flags } = item as OutputValues;
  return { flags: $flags };
});

export const resultFormatterFunction = fun(({ result, flags }) => {
  let contentDetected = false;
  const inputs = result as OutputValues;
  const item: Context[] = [];
  const f = flags as FunctionCallFlags;
  if (f) {
    if (f.outputLLMContent) {
      const content = inputs[f.outputLLMContent] as Context;
      content.role = "tool";
      item.push(content);
      contentDetected = true;
    } else if (f.outputLLMContentArray) {
      const contentArray = inputs[f.outputLLMContentArray] as Context[];
      contentArray.forEach((content) => {
        if (content.role !== "$metadata") {
          content.role = "tool";
        }
        item.push(content);
      });
      contentDetected = true;
    }
  } else {
    // TODO: Deprecate and remove. This is the old way of
    // detecting LLMContent (before flags were introduced).
    // There should only be a handful of tools that use this.
    for (const key in inputs) {
      const input = inputs[key] as { content: LlmContent };
      if (input !== null && typeof input === "object" && "content" in input) {
        // Presume that this is an LLMContent
        const content = input.content;
        // Let's double check...
        if (content.parts && Array.isArray(content.parts)) {
          content.role = "tool";
          item.push(content);
          contentDetected = true;
        }
      }
    }
  }
  if (!contentDetected) {
    const text = JSON.stringify(inputs);
    item.push({ parts: [{ text }], role: "tool" } satisfies LlmContent);
  }
  return { item };
});

const resultFormatter = code(resultFormatterFunction);

export const invokeBoardWithArgs = await board(({ item }) => {
  const unpackArgs = argsUnpacker({
    $metadata: {
      title: "Unpack args",
      description: "Unpacking board arguments",
    },
    item,
  });

  const getFlags = flagGetter({
    $metadata: {
      title: "Get flags",
      description: "Getting flags for the board invocation",
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

  const formatResults = resultFormatter({
    $metadata: { title: "Format results", description: "Formatting results" },
    result: packResults.result,
    flags: getFlags.flags,
  });

  return { item: formatResults.item };
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

export type FunctionCallFlags = {
  inputLLMContent?: string;
  inputLLMContentArray?: string;
  outputLLMContent?: string;
  outputLLMContentArray?: string;
};

export type FunctionDeclaration = {
  name: string;
  description?: string;
  parameters?: Schema;
};

export const functionSignatureFromBoardFunction = fun(({ board }) => {
  const b = board as GraphDescriptor;
  const inputs = b.nodes.filter((node) => node.type === "input") || [];
  const outputs = b.nodes.filter((node) => node.type === "output");
  if (outputs.length === 0) {
    throw new Error("No outputs found");
  }
  // For now, only support one input/output.
  // TODO: Implement support for multiple inputs/outputs.
  const inputSchema = (inputs[0]?.configuration?.schema || {}) as Schema;
  const outputSchema = outputs[0].configuration?.schema as Schema;
  if (!outputSchema) {
    throw new Error("No output schema found");
  }
  const properties: Record<string, Schema> = {};
  const flags: FunctionCallFlags = {};
  for (const key in inputSchema.properties) {
    const property = inputSchema.properties[key];
    const isObject = property.type === "object";
    const isArray = property.type === "array";
    const type = isObject || isArray ? "string" : property.type;
    if (isObject && property.behavior?.includes("llm-content")) {
      flags.inputLLMContent = key;
    } else if (
      isArray &&
      (property.items as Schema)?.behavior?.includes("llm-content")
    ) {
      flags.inputLLMContentArray = key;
      continue;
    }
    const description = property.description || property.title || "text";
    properties[key] = { type, description };
  }
  if (flags.inputLLMContentArray) {
    // Change the name of `board.args` parameter from `context` to the one
    // specified by the flag.
    if (flags.inputLLMContentArray !== "context") {
      const c = b.args?.context;
      if (c) {
        b.args ??= {};
        b.args[flags.inputLLMContentArray] = c;
        delete b.args.context;
      }
    }
  } else {
    // Remove the `context` parameter from the board args.
    // There's no property that corresponds to it.
    delete b.args?.context;
  }
  for (const key in outputSchema.properties) {
    const property = outputSchema.properties[key];
    const isObject = property.type === "object";
    const isArray = property.type === "array";
    if (isObject && property.behavior?.includes("llm-content")) {
      flags.outputLLMContent = key;
    } else if (
      isArray &&
      (property.items as Schema)?.behavior?.includes("llm-content")
    ) {
      flags.outputLLMContentArray = key;
    }
  }
  const name = b.title?.replace(/\W/g, "_") || "function";
  const description = b.description;
  const parameters =
    Object.entries(properties).length > 0
      ? {
          type: "object",
          properties,
        }
      : undefined;

  const f: FunctionDeclaration = { name, description };
  if (parameters) {
    f.parameters = parameters;
  }
  return {
    function: f,
    returns: outputSchema,
    flags,
    board,
  };
});

export const functionSignatureFromBoard = code(
  functionSignatureFromBoardFunction
);

export const boardToFunction = await board(({ item, context }) => {
  const url = item.isString();

  const importBoard = core.curry({
    $board: url,
    context,
  });

  const getFunctionSignature = functionSignatureFromBoard({
    $metadata: { title: "Get Function Signature from board" },
    board: importBoard.board,
  });

  return {
    function: getFunctionSignature.function,
    boardURL: getFunctionSignature.board,
    flags: getFunctionSignature.flags,
  };
}).serialize({
  title: "Board to functions",
  description:
    "Use this board to convert specified boards into function-calling signatures",
});

type FunctionSignatureItem = {
  function: { name: string };
  boardURL: string;
  flags: FunctionCallFlags;
};

export const functionDeclarationsFormatter = code(({ list }) => {
  const tools: unknown[] = [];
  const urlMap: URLMap = {};
  (list as FunctionSignatureItem[]).forEach((item) => {
    tools.push(item.function);
    const flags = item.flags;
    urlMap[item.function.name] = { url: item.boardURL, flags };
  });
  return { tools, urlMap };
});

export type ToolResponse = { item: LlmContent[] };

export const responseCollatorFunction = fun(({ response, context }) => {
  const r = response as ToolResponse[];
  const c = context as LlmContent[];
  const result: Record<string, LlmContent[] | string> = Object.fromEntries(
    r.map((item, i) => [`context-${i + 1}`, item.item])
  );
  if (c) {
    result["context-0"] = c;
  }
  return result;
});

export const responseCollator = code(responseCollatorFunction);

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, jsonSchema, object, optional } from "@breadboard-ai/build";
import {
  type ConvertBreadboardType,
  type JsonSerializable,
} from "@breadboard-ai/build/internal/type-system/type.js";
import {
  type GraphDescriptor,
  type OutputValues,
  type Schema,
  code,
} from "@google-labs/breadboard";
import {
  type Context,
  type FunctionCall,
  type LlmContent,
  fun,
  llmContentType,
} from "./context.js";

export const functionOrTextRouterFunction = ({
  context,
}: {
  context: LlmContent;
}): { context: LlmContent; text: string; functionCalls: FunctionCall[] } => {
  type TempUnsafeResult = {
    context: LlmContent;
    text: string;
    functionCalls: FunctionCall[];
  };
  if (!context) throw new Error("Context is a required input");
  const item = context;
  const functionCallParts = item.parts
    .filter((part) => "functionCall" in part)
    .map((part) => part.functionCall);
  if (functionCallParts.length === 0) {
    const textPart = item.parts.find((part) => "text" in part);
    if (!textPart) throw new Error("No text or function call found in context");
    return { context, text: textPart.text } as TempUnsafeResult;
  }
  return { context, functionCalls: functionCallParts } as TempUnsafeResult;
};

export const functionOrTextRouter = code(functionOrTextRouterFunction);

export const functionCallFlagsType = object({
  inputLLMContent: optional("string"),
  inputLLMContentArray: optional("string"),
  outputLLMContent: optional("string"),
  outputLLMContentArray: optional("string"),
});

export type FunctionCallFlags = ConvertBreadboardType<
  typeof functionCallFlagsType
>;

export const urlMapType = object(
  {},
  object({ url: "string", flags: functionCallFlagsType })
);
export type URLMap = ConvertBreadboardType<typeof urlMapType>;

export const boardInvocationArgsType = object(
  {
    $board: "string",
    $flags: functionCallFlagsType,
  },
  "unknown"
);
export type BoardInvocationArgs = ConvertBreadboardType<
  typeof boardInvocationArgsType
>;

export const boardInvocationAssemblerFunction = ({
  functionCalls,
  urlMap,
}: {
  functionCalls: FunctionCall[];
  urlMap: URLMap;
}): { list: BoardInvocationArgs[] } => {
  if (!functionCalls) {
    throw new Error("Function call array is a required input");
  }
  if (!urlMap) {
    throw new Error("URL map is a required input");
  }
  const calls = functionCalls;
  if (calls.length === 0) {
    throw new Error("Function call array must not be empty.");
  }
  const list: BoardInvocationArgs[] = [];
  for (const call of calls) {
    const item = urlMap[call.name];
    const $board = item.url;
    const $flags = item.flags;
    const llmContentProperty =
      $flags.inputLLMContent || $flags.inputLLMContentArray;
    const invokeArgs: BoardInvocationArgs = { $board, $flags, ...call.args };
    if (llmContentProperty) {
      // convert args into LLMContent.
      const args = call.args;
      const text = args[llmContentProperty] || "";
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
};

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

export const functionDeclarationType = object({
  name: "string",
  description: optional("string"),
  parameters: optional(jsonSchema),
});
export type FunctionDeclaration = ConvertBreadboardType<
  typeof functionDeclarationType
>;

export const functionSignatureFromBoardFunction = ({
  board,
}: {
  board: Record<string, JsonSerializable>;
}): {
  function: FunctionDeclaration;
  returns: Schema;
  flags: FunctionCallFlags;
  board: Record<string, JsonSerializable>;
} => {
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
};

export type FunctionSignatureItem = {
  function: { name: string };
  boardURL: string;
  flags: FunctionCallFlags;
};

export const functionDeclarationsFormatterFn = ({
  list,
}: {
  list: FunctionSignatureItem[];
}): { tools: JsonSerializable[]; urlMap: URLMap } => {
  const tools: JsonSerializable[] = [];
  const urlMap: URLMap = {};
  list.forEach((item) => {
    tools.push(item.function);
    const flags = item.flags;
    urlMap[item.function.name] = { url: item.boardURL, flags };
  });
  return { tools, urlMap };
};

export const toolResponseType = object({ item: array(llmContentType) });
export type ToolResponse = ConvertBreadboardType<typeof toolResponseType>;

export const responseCollatorFunction = ({
  response,
  context,
  generated,
}: {
  response: ToolResponse[];
  context?: LlmContent[];
  generated: LlmContent;
}): Record<string, LlmContent[] | string> => {
  const result = Object.fromEntries(
    response.map((item, i) => [`context-${i + 2}`, item.item])
  );
  if (context) {
    result["context-0"] = context;
  }
  result["context-1"] = [generated];
  return result;
};

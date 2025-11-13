/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { conformGeminiBody, generateContent } from "../../a2/gemini";
import { llm } from "../../a2/utils";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { FunctionDefinition, mapDefinitions } from "../function-definition";
import { err, ok } from "@breadboard-ai/utils";

export { generateOutput };

/**
 * Generates output, combining content input and a provided function.
 */

async function generateOutput(
  content: LLMContent,
  fn: FunctionDefinition,
  moduleArgs: A2ModuleArgs
) {
  const defs = mapDefinitions([fn]);
  const body = await conformGeminiBody(moduleArgs, {
    contents: [content],
    systemInstruction,
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
    generationConfig: { temperature: 0, topP: 1 },
    tools: [{ functionDeclarations: defs.declarations }],
  });
  if (!ok(body)) return body;
  const generating = await generateContent(
    "gemini-flash-latest",
    body,
    moduleArgs
  );
  if (!ok(generating)) return generating;

  const functionCall = (generating.candidates?.at(0)?.content?.parts || [])
    .filter((part) => "functionCall" in part)
    ?.at(0)?.functionCall;

  if (!functionCall) {
    return err(`No function call produced`);
  }

  return fn.handler(functionCall.args as Record<string, unknown>, (status) => {
    console.log("Status update", status);
  });
}

const systemInstruction = llm`
You are an LLM-powered output generator. Your job is to call provided function with the right arguments to generate output based on the provided input.
`.asContent();

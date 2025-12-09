/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  conformGeminiBody,
  GeminiSchema,
  generateContent,
  GenerationConfig,
} from "../../a2/gemini.js";
import { llm } from "../../a2/utils.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { FunctionDefinition, mapDefinitions } from "../function-definition.js";
import { err, ok } from "@breadboard-ai/utils";
import { parseJson } from "../../parse-json.js";

export { generateOutputViaJson, generateOutputViaFunction };

const commonConfig: GenerationConfig = {
  temperature: 0,
  topP: 1,
  thinkingConfig: { thinkingBudget: -1 },
};

const commonInstruction = `
Ensure full fidelity of translation: 
- all content in the provided input must appear in your output. 
- DO NOT truncate or elide text from the input
- Preserve the input text formatting, markdown in particular.`;

/**
 * Generates output, combining content input and a provided function.
 */
async function generateOutputViaJson(
  content: LLMContent,
  fn: FunctionDefinition,
  moduleArgs: A2ModuleArgs
) {
  const systemInstruction = llm`
You are an LLM-powered output translator.

Your job is to generate structured data (JSON) based on the provided input. 

${commonInstruction}`.asContent();

  const body = await conformGeminiBody(moduleArgs, {
    contents: [content],
    systemInstruction,
    generationConfig: {
      ...commonConfig,
      responseMimeType: "application/json",
      responseJsonSchema: fn.parametersJsonSchema as GeminiSchema,
    },
  });
  if (!ok(body)) return body;
  const generating = await generateContent(
    "gemini-flash-latest",
    body,
    moduleArgs
  );
  if (!ok(generating)) return generating;

  const parameters = parseJson<Record<string, unknown>>(generating);
  if (!ok(parameters)) return parameters;

  return fn.handler(parameters, (status) => {
    console.log("Status update", status);
  });
}

async function generateOutputViaFunction(
  content: LLMContent,
  fn: FunctionDefinition,
  moduleArgs: A2ModuleArgs
) {
  const systemInstruction = llm`
You are an LLM-powered output translator.

Your job is to call provided function with the right arguments to generate output based on the provided input.

${commonInstruction}`.asContent();

  const defs = mapDefinitions([fn]);
  const body = await conformGeminiBody(moduleArgs, {
    systemInstruction,
    contents: [content],
    toolConfig: { functionCallingConfig: { mode: "ANY" } },
    generationConfig: commonConfig,
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

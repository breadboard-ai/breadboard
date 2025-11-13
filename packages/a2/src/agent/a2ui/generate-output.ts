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
} from "../../a2/gemini";
import { llm } from "../../a2/utils";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { FunctionDefinition, mapDefinitions } from "../function-definition";
import { err, ok } from "@breadboard-ai/utils";
import { parseJson } from "../../parse-json";

export { generateOutputJson, generateOutputFunction };

/**
 * Generates output, combining content input and a provided function.
 */
async function generateOutputJson(
  content: LLMContent,
  example: unknown,
  fn: FunctionDefinition,
  moduleArgs: A2ModuleArgs
) {
  const systemInstruction = llm`
You are an LLM-powered output translator. Your job is to generate structured data (JSON) based on the provided input. Ensure full fidelity of translation: everything in the provide input must appear in your output.

Here's an example of the output(with sample data):
\`\`\`json
${JSON.stringify(example)}
\`\`\`

Your output must have the same structure, but include all of the input data.
`.asContent();

  const body = await conformGeminiBody(moduleArgs, {
    contents: [content],
    systemInstruction,
    generationConfig: {
      temperature: 0,
      topP: 1,
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

async function generateOutputFunction(
  content: LLMContent,
  example: unknown,
  fn: FunctionDefinition,
  moduleArgs: A2ModuleArgs
) {
  const systemInstruction = llm`
You are an LLM-powered output translator. Your job is to call provided function with the right arguments to generate output based on the provided input. Ensure full fidelity of translation: everything in the provide input must appear in your output.

Here's an example of the output(with sample data):
\`\`\`json
${JSON.stringify(example)}
\`\`\`

Your output must have the same structure, but include all of the input data.
`.asContent();

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

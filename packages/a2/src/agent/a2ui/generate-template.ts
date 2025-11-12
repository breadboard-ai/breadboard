/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../a2/utils";
import {
  generateContent,
  type GeminiBody,
  type GeminiSchema,
} from "../../a2/gemini";
import type { LLMContent } from "@breadboard-ai/types";
import { A2UI_SCHEMA } from "../../a2/au2ui-schema";
import { SurfaceSpec } from "./generate-spec";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { parseJson } from "../../parse-json";

export { generateTemplate };

function createPrompt(contents: LLMContent[]): GeminiBody {
  return {
    contents,
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseJsonSchema,
    },
  };
}

const systemInstruction = llm`
You are an LLM-powered UI creator, embedded into an application.

Your job is to analyze the provided surface specification and build the user interface necessary to fulfill the specification.

The UI is rendered with UI surfaces. Each surface is a tree of UI components that occupies a contiguous area of screen real estate. The "surfaceId" property uniquely identifies such an area.

You will be provided with a surface along with an ID, description, surface specification, data model specification, some example data, a schema for the data model and, a schema for responses.

The responses are actions that the user can take within the UI that will built.

The UI will be built in two phases. You are responsible for the first phase, where the UI will be populated with surface information. This will require you to provide an array containing a single surfaceUpdate and a single beginRendering.

Later another LLM-powered creator will be responsible for populating the data using the same data model schema and a dataModelUpdate of their own, so you must use assume paths for the data and avoid literals.`.asContent();

const responseJsonSchema: GeminiSchema = {
  type: "array",
  items: A2UI_SCHEMA,
};

async function generateTemplate(spec: SurfaceSpec, moduleArgs: A2ModuleArgs) {
  console.log(`Rendering ${spec.surfaceId}`);
  const prompt = createPrompt([llm`${JSON.stringify(spec)}`.asContent()]);

  const ui = await generateContent("gemini-flash-latest", prompt, moduleArgs);
  return parseJson(ui);
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../a2/utils";
import { GeminiInputs, GeminiSchema } from "../../a2/gemini";
import { LLMContent } from "@breadboard-ai/types";
import { UI_SCHEMA } from "../../a2/render-consistent-ui";

const SPEC_DESIGNER_MODEL = "gemini-flash-latest";

export { getCreateUILayoutPrompt };

function getCreateUILayoutPrompt(contents: LLMContent[]): GeminiInputs {
  const prompt: GeminiInputs = {
    model: SPEC_DESIGNER_MODEL,
    body: {
      contents,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseJsonSchema,
      },
    },
  };
  return prompt;
}

const systemInstruction = llm`
You are an LLM-powered UI creator, embedded into an application.

Your job is to analyze the provided surface specification and build the user interface necessary to fulfill the specification.

The UI is rendered with UI surfaces. Each surface is a tree of UI components that occupies a contiguous area of screen real estate. The "surfaceId" property uniquely identifies such an area.

You will be provided with a surface along with an ID, description, surface specification, data model specification, some example data, a schema for the data model and, a schema for responses.

The responses are actions that the user can take within the UI that will built.

The UI will be built in two phases. You are responsible for the first phase, where the UI will be populated with surface information. This will require you to provide an array containing surfaceUpdate, beginRendering and a dataModelUpdate messages. The data you should use is the example data, and the schema must match the dataModelSchema you are being provided.

If the dataModelUpdate requires you to send valueMaps you will need to be very careful with paths that access that data. For example, if you are sending a valueMap that looks like this: { "key": "person", "valueMap": [ { "key": "name", "valueString": "John Doe" }, { "key": "age", "valueNumber": 41 }, { "key": "isSubscriber", "valueBoolean": true } ] } you would need to reference the name as "/person/name" without any other additions or suffixes.


Later another LLM-powered creator will be responsible for populating the real data using the same data model schema and a dataModelUpdate of their own, so you must use it as defined so that it remains consistent between LLM calls.`.asContent();

const responseJsonSchema: GeminiSchema = {
  type: "array",
  items: UI_SCHEMA,
};

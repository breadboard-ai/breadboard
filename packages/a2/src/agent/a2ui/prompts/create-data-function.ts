/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../../a2/utils";
import type { GeminiBody } from "../../../a2/gemini";
import type { LLMContent } from "@breadboard-ai/types";

export { getUIDataFunctionPrompt };

const dataModelUpdateSchema = {
  type: "object",
  properties: {
    dataModelUpdate: {
      type: "object",
      properties: {
        surfaceId: {
          type: "string",
          description:
            "The unique identifier for the UI surface this data model update applies to.",
        },
        path: {
          type: "string",
          description:
            "An optional slash-delimited path to a location within the data model (e.g., '/user/name'). If omitted, or set to '/', the entire data model will be replaced with the contents.",
        },
        contents: {
          type: "object",
          additionalProperties: true,
          description:
            "A nested object that represents the data needed to power the view",
        },
      },
    },
  },
};

function getUIDataFunctionPrompt(contents: LLMContent[]): GeminiBody {
  return {
    contents,
    systemInstruction,
  };
}

const systemInstruction = llm`
You are an LLM-powered UI creator, embedded into an application.

Your job is to analyze the provided surface specification and provide a function that converts ANY data matching the dataModelSchema into a valid dataModelUpdate object which will be used to update the surface that has been derived from the surface.

Take a very close look both at the surface information and the dataModelSchema, particularly at any paths in the surface that need to be satisfied in order to update the UI.

Create a pure JavaScript function with no dependencies that converts data matching dataModelSchema and which returns a valid dataModelUpdate.

The dataModelUpdate returned by the function MUST match this schema: ${JSON.stringify(dataModelUpdateSchema)}

You MUST not wrap the function in anything. You are part of a wider LLM pipeline so no additional chit-chat. Return the function as plain text only`.asContent();

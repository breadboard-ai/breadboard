/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../a2/utils";
import { GeminiInputs } from "../../a2/gemini";
import { LLMContent } from "@breadboard-ai/types";

const SPEC_DESIGNER_MODEL = "gemini-flash-latest";

export { getUIDataUpdatePrompt };

const responseJsonSchema = {
  type: "array",
  items: {
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
  },
};

function getUIDataUpdatePrompt(contents: LLMContent[]): GeminiInputs {
  const prompt: GeminiInputs = {
    model: SPEC_DESIGNER_MODEL,
    body: {
      contents,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema,
      },
    },
  };
  return prompt;
}

const systemInstruction = llm`
You are an LLM-powered UI creator, embedded into an application.

Your job is to analyze the provided surface specification and provide the data to update the interface specified.

The UI is rendered with UI surfaces. Each surface is a tree of UI components that occupies a contiguous area of screen real estate. The "surfaceId" property uniquely identifies such an area.

You will be provided with a surface along with an ID, description, surface specification, data model specification, some example data, a schema for the data model and, a schema for responses.

The responses are actions that the user can take within the UI that will built.

You are responsible for populating the view with data. This will require you to provide an array containing a SINGLE dataModelUpdate that contains a complete nested data structure that can power the view. The nested structure can contain strings, booleans, numbers, Arrays, and objects. You should work on the basis that paths must map 1x:1 to this data structure.

## Data Paths

You MUST look at paths in the generated UI and ensure that the structure of the dataModelUpdate's contents you provide matches the expected structure. EVERY segment of a path MUST be represented in the final structure.

### GOOD Data Structure for paths.
The following approach is considered good:

{
  "options": [
    {
      "label": "Item 1"
    },
    {
      "label": "Item 2"
    },
    {
      "label": "Item 3"
    }
  ]
}
Reason this is good: a path of "/options/0/label" meets the data contract because options -> 0 -> label would result in "Item 1".

A BAD version of this would be:

{
  "options": [
    "Item 1",
    "Item 2",
    "Item 3"
  ]
}

Reason this is bad: "/options/0/label" would not resolve correctly as options -> 0 would result in "Item 1" and therefore the "label" segment would fail.

`.asContent();

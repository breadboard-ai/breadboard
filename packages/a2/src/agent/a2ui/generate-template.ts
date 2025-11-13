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
import type { LLMContent, Outcome } from "@breadboard-ai/types";
import { A2UI_SCHEMA } from "../../a2/au2ui-schema";
import { SurfaceSpec } from "./generate-spec";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { parseJson } from "../../parse-json";
import { ok } from "@breadboard-ai/utils";

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

Later another LLM-powered creator will be responsible for populating the data using the same data model schema and a dataModelUpdate of their own, so you must use assume paths for the data and avoid literals. If you use templates you should ensure that the dataBinding property begins with a \`/\` only when it refers to some data in the root.

Suppose we had the following data:

{
  items: [
    { details: 'Details 1' },
    { details: 'Details 2' },
  ]
}

And we have the following surface.

{
  "id": "item_row",
  "component": {
    "Row": {
      "children": {
        "template": {
          "componentId": "item",
          "dataBinding": "/items"
        }
      },
    }
  }
}

The data bound paths for the children will be remapped. This, then is a GOOD example for the item component:

{
  "id": "item",
  "component": {
    "List": {
      "children": {
        "template": {
          "componentId": "details",
          "dataBinding": "details"
        }
      }
    }
  }
}

This is GOOD because the dataBinding would expand to \`/items/0/details\`, \`/items/1/details\` and so on.

This is a BAD example:

{
  "id": "item",
  "component": {
    "List": {
      "children": {
        "template": {
          "componentId": "details",
          "dataBinding": "/details"
        }
      }
    }
  }
}

This is BAD because the dataBinding of "/details" means we will look for details at the root of the data, and, per the data structure, /details does not exist at the root.
`.asContent();

const responseJsonSchema: GeminiSchema = {
  type: "array",
  items: A2UI_SCHEMA,
};

async function generateTemplate(
  spec: SurfaceSpec,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<unknown[]>> {
  console.log(`Rendering ${spec.surfaceId}`);
  const prompt = createPrompt([llm`${JSON.stringify(spec)}`.asContent()]);

  const ui = await generateContent("gemini-flash-latest", prompt, moduleArgs);
  if (!ok(ui)) return ui;
  return parseJson(ui) as unknown[];
}

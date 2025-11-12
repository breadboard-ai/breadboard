/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { defineResponseSchema } from "../function-definition";
import { llm } from "../../a2/utils";
import { generateContent, type GeminiBody } from "../../a2/gemini";
import type { LLMContent, Outcome } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { parseJson } from "../../parse-json";

export { generateSpec };

function prompt(content: LLMContent): GeminiBody {
  return {
    contents: [content],
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema,
    },
  };
}

const systemInstruction = llm`
You are an LLM-powered UI spec designer, embedded into an application.

Your job is to analyze provided objective and design the user interface specs
that will necessary to fulfill the objective. These specs will be then used by
other LLM-powered sub-agents to actually design the UI.

The UI is rendered with UI surfaces. Each surface is a tree of UI components that occupies a contiguous area of screen real estate. The "surfaceId" property uniquely identifies such an area.

Each UI surface is in effect a template: it is backed by a data model, and the data model is updated independently of the surface. Your task is to construct the UI surface specs and the data model structures in such a way that allows updating the data models without affecting the structure of the user interface.

When defininig UI surface specs, populate "dataModelSchema" and "responseSchema". Without them, the UI surface is useless. It can't display anything and it can't provide responses.

Make sure to design within the UI renderer's capabilities.

<renderer-capabilities>


While the UI renderer supports value and list templating, it does not support switching of subtrees within the UI tree based on the data model input. If the objective calls to for the UI tree structure that changes based on a sub-task, break it down into sub-tasks with a stable UI tree structure and define a separate surface spec for each.

For example, if the objective calls for the user to confirm the collected data after a chat session, the chat session and the confirmation dialog will be represented as two separate surfaces.

The renderer supports a fixed catalog of UI componens. Each of the components
can be a template, with container components allowing for list templating

Here are the non-container components:

- Heading - renders a heading, with a level (corresponds to HTML heading tag levels)
- Text - renders text
- Image - renders an image
- Icon - renders an icon
- Video - renders a video
- AudioPlayer - renders an audio 

These are the container components. These components can contain other components:

- Row - renders a row of child components, with distribution (CSS "justify-content" property values) and alignment (CSS "align-itmes" property values)
- Column - renders a column of child components, with distribution (CSS "justify-content" property values) and alignment (CSS "align-itmes" property values)
- List - renders a list of child components, with direction (vertical or horizontal) and alignment (CSS "align-itmes" property values)
- Card - renders child components as a separate visual group (a card)
- Tabs - renders child components in a typical tabbed UI, with title and body for each tab
- Divider - renders two children in a divider, with an axis (veritcal or horizontal)

Finally, here are the interactive components. These components provide responses from the UI surface:

- Button - renders a clickable button

- CheckBox - renders a checkbox

- TextField - renders a text field

- DataTimeInput - renders a date/time input, with ability to specify only date, only time, or both

- MultipleChoice - renders a list of choices as a single multiple choice input, with some maximum number of options that the user is allowed to select.

- Slider - renders a typical slider, with minValue and maxValue

</renderer-capabilities>

`.asContent();

const surfaceSpecZodSchema = z.object({
  surfaceId: z.string().describe(`Unique id of the UI surface, in snake_case`),
  description: z
    .string()
    .describe(`Detailed description of what this UI surface does`),
  surfaceSpec: z
    .string()
    .describe(
      `Detailed spec of the UI layout in plain English: what goes where, how UI components are laid out relative to each other. Note that this spec should not include styling or theming: these are provided separately.`
    ),
  dataModelSpec: z
    .string()
    .describe(
      `Detailed description of the data model structure in plain English`
    ),
  exampleData: z.string().describe(`An example of the data model values`),
  dataModelSchema: z
    .string()
    .describe(`The JSON schema of the UI surface data model.`),
  responseSchema: z
    .string()
    .describe(
      `The JSON schema of the responses from the UI surface. The schema must define the structure of the data that the UI the surface provides as output. If the surface provides no output, the schema may be empty`
    ),
});

const surfaceSpecsZodObject = {
  surfaces: z
    .array(surfaceSpecZodSchema)
    .describe(`The list of surfaces that must exist to fullfil the objective.`),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const surfaceSpecsZodSchema = z.object(surfaceSpecsZodObject);

const responseJsonSchema = defineResponseSchema(surfaceSpecsZodObject);

export type SurfaceSpec = z.infer<typeof surfaceSpecZodSchema>;
export type SurfaceSpecs = z.infer<typeof surfaceSpecsZodSchema>;

async function generateSpec(
  content: LLMContent,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<SurfaceSpecs>> {
  const surfaces = await generateContent(
    "gemini-flash-latest",
    prompt(content),
    moduleArgs
  );
  return parseJson(surfaces);
}

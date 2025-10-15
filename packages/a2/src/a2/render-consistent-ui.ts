/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { GeminiPrompt } from "./gemini-prompt";
import { ok, toJson } from "@breadboard-ai/utils";
import { GeminiSchema } from "./gemini";
import { llm } from "./utils";
import { StreamableReporter } from "./output";

export { renderConsistentUI };

const UI_SCHEMA: GeminiSchema = {
  description:
    "Schema that defines A2UI user interfaces with explicit, component-specific property descriptions to guide LLM generation.",
  type: "object",
  properties: {
    components: {
      type: "array",
      description:
        "A single list containing all UI components for the surface.",
      items: {
        type: "object",
        description:
          "A unified component object. The 'componentType' field indicates the component's role. Only properties relevant to that type should be set.",
        properties: {
          id: {
            type: "string",
            description: "The unique identifier for this component.",
          },
          componentType: {
            type: "string",
            description:
              "The type of this component, which determines which other properties are applicable.",
            enum: [
              "Heading",
              "Text",
              "Image",
              "Video",
              "AudioPlayer",
              "Row",
              "Column",
              "List",
              "Card",
              "Tabs",
              "Divider",
              "Modal",
              "Button",
              "CheckBox",
              "TextField",
              "DateTimeInput",
              "MultipleChoice",
              "Slider",
            ],
          },
          children: {
            type: "array",
            items: { type: "string" },
            description:
              "For container components (`Row`, `Column`, `List`), a list of child component IDs. Each ID must correspond to another component in this list.",
          },
          child: {
            type: "string",
            description:
              "For single-child containers (`Card`), the ID of the child component.",
          },
          text_literal: {
            type: "string",
            description:
              "A literal string value, used by `Heading` and `Text` components.",
          },
          text_path: {
            type: "string",
            description:
              "A data binding path for a text value, used by `Heading` and `Text` components.",
          },
          label_literal: {
            type: "string",
            description:
              "A literal string for a label, used by `TextField`, `Button`, and `CheckBox` components.",
          },
          label_path: {
            type: "string",
            description:
              "A data binding path for a label, used by `TextField`, `Button`, and `CheckBox` components.",
          },
          url_literal: {
            type: "string",
            description:
              "A literal URL, used by `Image`, `Video`, and `AudioPlayer` components.",
          },
          url_path: {
            type: "string",
            description:
              "A data binding path for a URL, used by `Image`, `Video`, and `AudioPlayer` components.",
          },
          level: {
            type: "string",
            enum: ["1", "2", "3", "4", "5"],
            description:
              "The semantic importance level for a `Heading` component.",
          },
          fit: {
            type: "string",
            enum: ["fill", "cover", "contain", "none", "scale-down"],
            description: "The fit behavior for an `Image` component.",
          },
          distribution: {
            type: "string",
            enum: [
              "start",
              "center",
              "end",
              "spaceBetween",
              "spaceAround",
              "spaceEvenly",
            ],
            description:
              "Distribution of items along the main axis for a `Row` or `Column` component.",
          },
          alignment: {
            type: "string",
            enum: ["start", "center", "end", "stretch"],
            description:
              "Alignment of items along the cross axis for a `Row`, `Column`, or `List` component.",
          },
          direction: {
            type: "string",
            enum: ["vertical", "horizontal"],
            description: "The layout direction for a `List` component.",
          },
          action: {
            type: "object",
            description: "Defines the action for a `Button` component.",
            properties: {
              name: {
                type: "string",
                description:
                  "The name of the action to be triggered by a `Button`.",
              },
              context: {
                type: "array",
                description:
                  "A list of key-value pairs to be sent with the `Button`'s action.",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    value_path: { type: "string" },
                    value_literal: { type: "string" },
                    value_literalNumber: { type: "number" },
                    value_literalBoolean: { type: "boolean" },
                  },
                  required: ["key"],
                },
              },
            },
            required: ["name", "context"],
          },
        },
        required: ["id", "componentType"],
      },
    },
  },
  required: ["components"],
};

function createFullSystemInstruction(si?: LLMContent) {
  return llm`You are a rendering agent. Your job is to represent the content, provided by
the user as a set of UI components, defined by the schema.

Specific instuctions for the content:

${si ?? "None"}`.asContent();
}

async function renderConsistentUI(
  caps: Capabilities,
  data: LLMContent,
  systemInstruction?: LLMContent
): Promise<Outcome<LLMContent[]>> {
  const prompt = new GeminiPrompt(caps, {
    model: "gemini-2.5-flash",
    body: {
      contents: [data],
      systemInstruction: createFullSystemInstruction(systemInstruction),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: UI_SCHEMA,
      },
    },
  });
  const generated = await prompt.invoke();
  if (!ok(generated)) return generated;
  const reporter = new StreamableReporter(caps, {
    title: "A2UI",
    icon: "web",
  });
  try {
    await reporter.start();
    await reporter.sendA2UI("Generated UI", toJson(generated.all), "download");
    return [llm`See Console`.asContent()];
  } finally {
    await reporter.close();
  }
}

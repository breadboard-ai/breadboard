/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isLLMContent, toText, llm } from "../a2/utils";
import { type GeminiSchema } from "../a2/gemini";
import { Template } from "../a2/template";

import type { AutonameMode, Arguments } from "./types";
import {
  Capabilities,
  JsonSerializable,
  LLMContent,
} from "@breadboard-ai/types";

export { NodeConfigurationUpdateMode };

const USER_INPUT_TYPE =
  "embed://a2/a2.bgl.json#21ee02e7-83fa-49d0-964c-0cab10eafc2c";
const GENERATE_TYPE = "embed://a2/generate.bgl.json#module:main";
const DISPLAY_TYPE = "embed://a2/a2.bgl.json#module:render-outputs";

type StepHandler = {
  canAutoname: boolean;
  prompt: LLMContent[];
};

type StepMap = Map<
  string,
  (configuration: Record<string, JsonSerializable>) => StepHandler
>;

function createStepMap(caps: Capabilities): StepMap {
  return new Map([
    [
      USER_INPUT_TYPE,
      (c) =>
        createStepHandler(
          "be presented to the application user to request their input",
          textFromConfiguration(caps, c, ["description"])
        ),
    ],
    [
      GENERATE_TYPE,
      (c) =>
        createStepHandler(
          `be used by one of the steps as a prompt for an LLM that outputs ${outputFromConfiguration(c)}`,
          textFromConfiguration(caps, c, ["config$prompt"])
        ),
    ],
    [
      DISPLAY_TYPE,
      (c) =>
        createStepHandler(
          "be used by one of the steps as a prompt for an LLM to render HTML for display",
          textFromConfiguration(caps, c, ["text"])
        ),
    ],
  ]);
}

function outputFromConfiguration(
  c: Record<string, JsonSerializable> | undefined
) {
  if (c && "generation-mode" in c) {
    const mode = c["generation-mode"] as string;
    switch (mode) {
      case "image-gen":
        return "a single image";
      case "image":
        return "images and text";
      case "audio":
        return "audio";
      case "video":
        return "video";
      default:
        return "text";
    }
  }
  return "text";
}

function createStepHandler(
  typeSpecficPrompt: string,
  text: string
): StepHandler {
  return {
    canAutoname: text.length > 10,
    prompt: [
      llm`
  Analyze the text below and provide suggestions for title and description that could be used
  to automatically label this text as one of the steps in a visual, a no-code application builder.
  Builders are creating applications by placing steps on a canvas and wiring them together into a visual flow.
  This text will ${typeSpecficPrompt}.

  Important:
  - Both the title and intent must be accurate, concise, and specific to the text
  - The description must be one sentence
  - Each title must be verb-first, action oriented, short and to the point
  - The builders are non-technical, so avoid overly technical jargon

  Text:
  
  ${text}

  `.asContent(),
    ],
  };
}

const DEFAULT_STEP_HANDLER: StepHandler = {
  canAutoname: false,
  prompt: [],
};

function stepHandlerFromArgs(caps: Capabilities, args: Arguments): StepHandler {
  const type = args.nodeConfigurationUpdate?.type;
  const configuration = args.nodeConfigurationUpdate?.configuration;
  if (!type || !configuration) return DEFAULT_STEP_HANDLER;
  const factory = createStepMap(caps).get(type);
  if (!factory) return DEFAULT_STEP_HANDLER;
  return factory(configuration);
}

class NodeConfigurationUpdateMode implements AutonameMode {
  #stepHandler: StepHandler;

  constructor(
    public readonly caps: Capabilities,
    public readonly args: Arguments
  ) {
    this.#stepHandler = stepHandlerFromArgs(caps, args);
    console.log("PROMPT", toText(this.#stepHandler.prompt));
  }

  canAutoname() {
    return this.#stepHandler.canAutoname;
  }
  prompt(): LLMContent[] {
    return this.#stepHandler.prompt;
  }

  schema(): GeminiSchema {
    return {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            "Suggested title for the prompt, verb-first, action oriented. Two words.",
        },
        description: {
          type: "string",
          description:
            "Suggested description for the prompt. Seven words or less",
        },
      },
      required: ["title", "description"],
    };
  }
}

function textFromConfiguration(
  caps: Capabilities,
  configuration: Record<string, JsonSerializable> | undefined,
  allow: string[]
): string {
  if (!configuration) return "";

  return Object.entries(configuration)
    .map(([name, value]) => {
      if (!allow.includes(name)) return "";
      if (isLLMContent(value)) {
        const template = new Template(caps, value);
        return toText(
          template.simpleSubstitute((part) => {
            if (part.type == "tool") return part.title;
            if (part.type === "asset") return `{{${part.title}}}`;
            return ``;
          })
        );
      }
      return JSON.stringify(value);
    })
    .join("");
}

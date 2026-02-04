/**
 * @fileoverview Allows asking user for input that could be then used in next steps.
 * Consolidates text-entry.ts and text-main.ts into a single module using
 * direct caps.input/caps.output calls.
 */
import {
  BehaviorSchema,
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
  SchemaEnumValue,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { type Params } from "./common.js";
import { report } from "./output.js";
import { Template } from "./template.js";
import { defaultLLMContent, llm, toText } from "./utils.js";

export { invoke as default, describe };

const MODALITY: readonly string[] = [
  "Any",
  "Audio",
  "Image",
  "Text",
  "Upload File",
  "Video",
] as const;

type Modality = (typeof MODALITY)[number];

type UserInputInputs = {
  description?: LLMContent;
  "p-modality"?: Modality;
  "p-required"?: boolean;
} & Params;

type UserInputOutputs = {
  context: LLMContent[];
};

const ICONS: Record<Modality, string> = {
  Any: "asterisk",
  Audio: "mic",
  Video: "videocam",
  Image: "image",
  "Upload File": "upload",
  Text: "edit_note",
};

const HINTS: Record<Modality, BehaviorSchema> = {
  Any: "hint-multimodal",
  Audio: "hint-audio",
  Video: "hint-image",
  Image: "hint-image",
  "Upload File": "hint-text",
  Text: "hint-text",
};

function computeIcon(modality?: Modality): string {
  return (modality && ICONS[modality]) || "asterisk";
}

function computeHint(modality?: Modality): BehaviorSchema {
  return (modality && HINTS[modality]) || "hint-multimodal";
}

function combineModalities(modalities: readonly string[]): SchemaEnumValue[] {
  const schemaEnum: SchemaEnumValue[] = modalities.map((modality) => ({
    id: modality,
    title: modality,
    icon: ICONS[modality],
  }));
  return schemaEnum;
}

async function invoke(
  {
    description,
    "p-modality": modality,
    "p-required": required,
    ...params
  }: UserInputInputs,
  caps: Capabilities
): Promise<Outcome<UserInputOutputs>> {
  const template = new Template(caps, description);
  let details = llm`Please provide input`.asContent();
  if (description) {
    const substituting = await template.substitute(params, async () => "");
    if (!ok(substituting)) {
      return substituting;
    }
    details = substituting;
  }

  // Report to console
  await report(caps, {
    actor: "User Input",
    category: "Requesting Input",
    name: "",
    details,
    icon: "input",
    chat: true,
  });

  const title = toText(details);
  const requiredBehavior: BehaviorSchema[] = required ? ["hint-required"] : [];

  // Output the prompt to display to user
  await caps.output({
    schema: {
      type: "object",
      properties: {
        message: {
          type: "object",
          behavior: ["llm-content"],
          title,
        },
      },
    },
    message: details,
  });

  // Request input from user
  const response = (await caps.input({
    schema: {
      type: "object",
      properties: {
        request: {
          type: "object",
          title,
          behavior: ["transient", "llm-content", ...requiredBehavior],
          examples: [defaultLLMContent()],
          format: computeIcon(modality),
        },
      },
    },
  })) as Outcome<{ request?: LLMContent }>;

  if (!ok(response)) {
    return response;
  }

  // Return context with the user's response
  if (!response.request) {
    return { context: [] };
  }
  return { context: [response.request] };
}

type DescribeInputs = {
  inputs: UserInputInputs;
};

async function describe(
  { inputs: { description, ["p-modality"]: modality } }: DescribeInputs,
  caps: Capabilities
) {
  const icon = computeIcon(modality);
  const template = new Template(caps, description);
  return {
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "What to ask of user",
          description:
            "Provide a request prompt that will be shown to the user.",
        },
        "p-modality": {
          type: "string",
          enum: combineModalities(MODALITY),
          behavior: ["config", "hint-preview", "hint-advanced"],
          icon,
          title: "Input type",
          description: "Set the type of input the user can provide",
        },
        "p-required": {
          type: "boolean",
          behavior: ["config", "hint-preview", "hint-advanced"],
          icon,
          title: "Input is required",
          description: "Set whether or not the user's input is required",
        },
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      additionalProperties: true,
      ...template.requireds(),
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["main-port", computeHint(modality)],
        },
      },
      additionalProperties: false,
    } satisfies Schema,
    title: "User Input",
    metadata: {
      icon: "ask-user",
      tags: ["quick-access", "core", "input"],
      order: 1,
    },
  };
}

/**
 * @fileoverview Allows asking user for input that could be then used in next steps.
 */
import { ok, defaultLLMContent, toText, llm } from "./utils";
import { type Params } from "./common";
import { Template } from "./template";
import { report } from "./output";

export { invoke as default, describe };

const MODALITY: readonly string[] = [
  "Any",
  "Audio",
  "Image",
  "Video",
  "Upload File",
] as const;

type Modality = (typeof MODALITY)[number];

type TextInputs = {
  description?: LLMContent;
  "p-modality"?: Modality;
} & Params;

type TextOutputs =
  | {
      toInput: Schema;
      context: "nothing";
    }
  | {
      toMain: string;
      context: LLMContent;
    };

function toInput(title: string, modality: Modality | undefined) {
  const toInput: Schema = {
    type: "object",
    properties: {
      request: {
        type: "object",
        title,
        behavior: ["transient", "llm-content"],
        examples: [defaultLLMContent()],
        format: computeIcon(modality),
      },
    },
  };
  return toInput;
}

const ICONS: Record<Modality, string> = {
  Any: "multimodal",
  Audio: "audio",
  Video: "video",
  Image: "image",
  "Upload File": "file",
};

const HINTS: Record<Modality, BehaviorSchema> = {
  Any: "hint-multimodal",
  Audio: "hint-audio",
  Video: "hint-image",
  Image: "hint-image",
  "Upload File": "hint-text",
};

function computeIcon(modality?: Modality): string {
  return (modality && ICONS[modality]) || "multimodal";
}

function computeHint(modality?: Modality): BehaviorSchema {
  return (modality && HINTS[modality]) || "hint-multimodal";
}

async function invoke({
  description,
  "p-modality": modality,
  ...params
}: TextInputs): Promise<Outcome<TextOutputs>> {
  const template = new Template(description);
  let details = llm`Please provide input`.asContent();
  if (description) {
    const substituting = await template.substitute(params, async () => "");
    if (!ok(substituting)) {
      return substituting;
    }
    details = substituting;
  }
  await report({
    actor: "Ask User",
    category: "Requesting Input",
    name: "",
    details,
    icon: "input",
  });
  const title = toText(details);
  return { context: "nothing", toInput: toInput(title, modality) };
}

type DescribeInputs = {
  inputs: TextInputs;
};

async function describe({
  inputs: { description, ["p-modality"]: modality },
}: DescribeInputs) {
  const icon = computeIcon(modality);
  const template = new Template(description);
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
          enum: MODALITY as string[],
          behavior: ["config", "hint-preview"],
          icon,
          title: "Input type",
          description: "Set the type of input the user can provide",
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
    title: "Ask User",
    metadata: {
      icon: "input",
      tags: ["quick-access", "core", "input"],
      order: 1,
    },
  };
}

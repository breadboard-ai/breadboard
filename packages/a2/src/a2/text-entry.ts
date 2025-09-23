/**
 * @fileoverview Allows asking user for input that could be then used in next steps.
 */
import { type Params } from "./common";
import { report } from "./output";
import { Template } from "./template";
import { defaultLLMContent, llm, ok, toText } from "./utils";

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
  { description, "p-modality": modality, ...params }: TextInputs,
  caps: Capabilities
): Promise<Outcome<TextOutputs>> {
  const template = new Template(caps, description);
  let details = llm`Please provide input`.asContent();
  if (description) {
    const substituting = await template.substitute(params, async () => "");
    if (!ok(substituting)) {
      return substituting;
    }
    details = substituting;
  }
  await report(caps, {
    actor: "User Input",
    category: "Requesting Input",
    name: "",
    details,
    icon: "input",
    chat: true,
  });
  const title = toText(details);
  return { context: "nothing", toInput: toInput(title, modality) };
}

type DescribeInputs = {
  inputs: TextInputs;
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

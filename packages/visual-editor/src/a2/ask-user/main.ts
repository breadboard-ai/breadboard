/**
 * @fileoverview Imperative implementation of the Ask User step.
 * Combines the logic of text-entry.ts and text-main.ts into a single function.
 */

import {
  BehaviorSchema,
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
  SchemaEnumValue,
} from "@breadboard-ai/types";
import { type Params } from "../a2/common.js";
import { report } from "../a2/output.js";
import { Template } from "../a2/template.js";
import { defaultLLMContent, llm, ok, toText } from "../a2/utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { requestInput } from "../request-input.js";

export { invoke as default, describe, askUser };

const MODALITY: readonly string[] = [
  "Any",
  "Audio",
  "Image",
  "Text",
  "Upload File",
  "Video",
] as const;

type Modality = (typeof MODALITY)[number];

type AskUserInputs = {
  description?: LLMContent;
  "p-modality"?: Modality;
  "p-required"?: boolean;
} & Params;

type AskUserOutputs = {
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

/**
 * Creates the input schema for the user input request.
 */
function createInputSchema(
  title: string,
  modality: Modality | undefined,
  required: boolean | undefined
): Schema {
  const requiredBehavior: BehaviorSchema[] = required ? ["hint-required"] : [];
  return {
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
  };
}

/**
 * Imperative replacement for the Ask User subgraph.
 * Combines text-entry module (report + schema creation) and text-main module
 * (input handling) into a single function.
 */
async function askUser(
  inputs: AskUserInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AskUserOutputs>> {
  const {
    description,
    "p-modality": modality,
    "p-required": required,
    ...params
  } = inputs;

  // === text-entry phase: Build prompt and report status ===
  const template = new Template(caps, description);
  let details = llm`Please provide input`.asContent();
  if (description) {
    const substituting = await template.substitute(params, async () => "");
    if (!ok(substituting)) {
      return substituting;
    }
    details = substituting;
  }

  await report(moduleArgs, {
    actor: "User Input",
    category: "Requesting Input",
    name: "",
    details,
    icon: "input",
    chat: true,
  });

  const title = toText(details);
  const inputSchema = createInputSchema(title, modality, required);

  // === input phase: Get user input ===
  const response = await requestInput(moduleArgs, inputSchema);
  if (!ok(response)) {
    return response;
  }
  const request = (response as Record<string, unknown>).request as
    | LLMContent
    | undefined;

  // === text-main phase: Return context ===
  if (!request) {
    // No input provided - return empty context
    return { context: [] };
  }

  return { context: [request] };
}

/**
 * Legacy invoke function for graph-based execution compatibility.
 * Delegates to askUser for imperative execution.
 */
async function invoke(
  inputs: AskUserInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AskUserOutputs>> {
  return askUser(inputs, caps, moduleArgs);
}

type DescribeInputs = {
  inputs: AskUserInputs;
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

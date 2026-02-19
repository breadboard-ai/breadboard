/**
 * @fileoverview Combines multiple outputs into one.
 */

import { Template } from "./template.js";
import { ok } from "./utils.js";
import { LLMContent, Outcome, Schema } from "@breadboard-ai/types";

export { invoke as default, describe };

type InvokeInputs = {
  text?: LLMContent;
};

type Outputs = {
  context: LLMContent[];
};

type DescribeInputs = {
  inputs: {
    text?: LLMContent;
  };
};

async function invoke({
  text,
  ...params
}: InvokeInputs): Promise<Outcome<Outputs>> {
  const template = new Template(text);
  const substituting = await template.substitute(params, async () => "");
  if (!ok(substituting)) {
    return substituting;
  }
  // Process single item directly (list support removed)
  return { context: [substituting] };
}

async function describe({ inputs: { text } }: DescribeInputs) {
  const template = new Template(text);
  return {
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "object",
          behavior: ["llm-content", "hint-preview", "config"],
          title: "Text",
          description: "Type the @ character to select the outputs to combine",
        },
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      ...template.requireds(),
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: {
            type: "object",
            behavior: ["llm-content"],
          },
          title: "Context out",
          behavior: ["main-port", "hint-multimodal"],
        },
      },
    } satisfies Schema,
    title: "Combine Outputs",
    metadata: {
      icon: "combine-outputs",
      tags: ["quick-access", "core", "experimental"],
      order: 100,
    },
  };
}

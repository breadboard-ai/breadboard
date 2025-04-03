/**
 * @fileoverview Combines multiple outputs into one.
 */

import { Template } from "./template";
import { ok } from "./utils";
import { fanOutContext, flattenContext } from "./lists";

export { invoke as default, describe };

type InvokeInputs = {
  text?: LLMContent;
  "z-flatten-list": boolean;
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
  "z-flatten-list": flatten,
  ...params
}: InvokeInputs): Promise<Outcome<Outputs>> {
  const template = new Template(text);
  const substituting = await template.substitute(params, async () => "");
  if (!ok(substituting)) {
    return substituting;
  }
  let context = await fanOutContext(
    substituting,
    undefined,
    async (instruction) => instruction
  );
  if (!ok(context)) return context;
  if (flatten) {
    context = flattenContext(context);
  }
  return { context };
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
        "z-flatten-list": {
          type: "boolean",
          behavior: ["hint-preview", "config"],
          icon: "summarize",
          title: "Flatten the list",
          description:
            "When checked, the step will flatten the incoming list into a single outputs",
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

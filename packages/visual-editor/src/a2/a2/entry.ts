/**
 * @fileoverview Manages the entry point: describer, passing the inputs, etc.
 */

import { LLMContent, Schema } from "@breadboard-ai/types";
import { type AgentContext, type DescribeInputs } from "./common.js";
import { Template } from "./template.js";
import { defaultLLMContent } from "./utils.js";

export { invoke as default, describe };

export type EntryInputs = {
  context: LLMContent[];
  description: LLMContent;
  [key: `p-z-${string}`]: unknown;
};

type Outputs = {
  context: AgentContext;
};

async function invoke({
  context,
  description,
  ...params
}: EntryInputs): Promise<Outputs> {
  context ??= [];
  const defaultModel = "";
  const type = "work";
  return {
    context: {
      id: Math.random().toString(36).substring(2, 5),
      context,
      defaultModel,
      model: "",
      description,
      tools: [],
      type,
      work: [],
      params,
    },
  };
}

async function describe({ inputs: { description } }: DescribeInputs) {
  const template = new Template(description);
  return {
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Instruction",
          description:
            "Give the model additional context on what to do, like specific rules/guidelines to adhere to or specify behavior separate from the provided context.",
          default: defaultLLMContent(),
        },
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
          behavior: ["main-port"],
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
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["main-port", "hint-text"],
        },
      },
    } satisfies Schema,
    title: "Make Text",
    metadata: {
      icon: "generative-text",
      tags: ["quick-access", "generative"],
      order: 1,
    },
  };
}

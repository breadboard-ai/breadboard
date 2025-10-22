/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  InputValues,
  LLMContent,
  Schema,
} from "@breadboard-ai/types";
import { Template } from "../a2/template";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";

export { invoke as default, describe };

async function invoke(
  inputs: InputValues,
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs
) {
  console.log("inputs", inputs, caps, moduleArgs);
  return { context: [] };
}

type AgentInputs = {
  objective: LLMContent;
};

async function describe({ objective }: AgentInputs, caps: Capabilities) {
  const template = new Template(caps, objective);
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
          behavior: ["main-port"],
        },
        query: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Research Query",
          description:
            "Provide a brief description of what to research, what areas to cover, etc.",
        },
        summarize: {
          type: "boolean",
          behavior: ["config", "hint-preview", "hint-advanced"],
          icon: "summarize",
          title: "Summarize research",
          description:
            "If checked, the Researcher will summarize the results of the research and only pass the research summary along.",
        },
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      ...template.requireds(),
      additionalProperties: false,
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
      additionalProperties: false,
    } satisfies Schema,
    title: "Do deep research",
    description: "Do deep research on the provided query",
    metadata: {
      icon: "generative-search",
      tags: ["quick-access", "generative"],
      order: 101,
    },
  };
}

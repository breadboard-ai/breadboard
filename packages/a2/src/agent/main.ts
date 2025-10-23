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
  config$prompt: LLMContent;
};

async function describe({ config$prompt }: AgentInputs, caps: Capabilities) {
  const template = new Template(caps, config$prompt);
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
        config$prompt: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Objective",
          description: "The objective for the agent",
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
    title: "Agent",
    description: "Iteratively works to solve the stated objective",
    metadata: {
      icon: "generative-search",
      tags: ["quick-access", "generative"],
      order: 101,
    },
  };
}

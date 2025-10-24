/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { Template } from "../a2/template";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";
import { Params } from "../a2/common";
import { Loop } from "./loop";
import { ok } from "@breadboard-ai/utils";

export { invoke as default, describe };

type AgentInputs = {
  config$prompt: LLMContent;
} & Params;

type AgentOutputs = {
  context: LLMContent[];
};

async function invoke(
  { config$prompt: objective, ...rest }: AgentInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs
): Promise<Outcome<AgentOutputs>> {
  const params = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith("p-z-"))
  );
  const loop = new Loop(caps, moduleArgs);
  const result = await loop.run(objective, params);
  if (!ok(result)) return result;
  console.log("LOOP", result);
  const context: LLMContent[] = [];
  if (result.outcomes) {
    context.push(result.outcomes);
  }
  return { context };
}

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

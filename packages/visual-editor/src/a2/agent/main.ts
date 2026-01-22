/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  RuntimeFlags,
  Schema,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { Params } from "../a2/common.js";
import { Template } from "../a2/template.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { Loop } from "./loop.js";
import type { ModelConstraint } from "./functions/generate.js";
import { readFlags } from "../a2/settings.js";

export { invoke as default, computeAgentSchema, describe };

export type AgentInputs = {
  config$prompt: LLMContent;
  "b-ui-consistent": boolean;
  "b-ui-prompt": LLMContent;
  "b-si-instruction"?: string;
  "b-si-constraint": ModelConstraint;
} & Params;

type AgentOutputs = {
  [key: string]: LLMContent[];
};

function computeAgentSchema(
  flags: Readonly<RuntimeFlags> | undefined,
  { "b-ui-consistent": enableA2UI = false }: Record<string, unknown>
) {
  const uiPromptSchema: Schema["properties"] =
    flags?.consistentUI && enableA2UI
      ? {
          "b-ui-prompt": {
            type: "object",
            behavior: ["llm-content", "config", "hint-advanced"],
            title: "UI Layout instructions",
            description: "Instructions for UI layout",
          },
        }
      : {};
  const uiConsistent: Schema["properties"] = flags?.consistentUI
    ? {
        "b-ui-consistent": {
          type: "boolean",
          title: "Use A2UI",
          behavior: ["config", "hint-advanced", "reactive"],
        },
      }
    : {};
  return {
    config$prompt: {
      type: "object",
      behavior: ["llm-content", "config", "hint-preview"],
      title: "Objective",
      description: "The objective for the agent",
    },
    ...uiConsistent,
    ...uiPromptSchema,
  } satisfies Schema["properties"];
}

async function invoke(
  {
    config$prompt: objective,
    "b-ui-consistent": enableA2UI = false,
    "b-ui-prompt": uiPrompt,
    "b-si-instruction": extraInstruction,
    "b-si-constraint": modelConstraint,
    ...rest
  }: AgentInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AgentOutputs>> {
  const params = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith("p-z-"))
  );
  const loop = new Loop(caps, moduleArgs);
  const result = await loop.run({
    objective,
    params,
    extraInstruction,
    uiType: enableA2UI ? "a2ui" : "chat",
    uiPrompt,
    modelConstraint,
  });
  if (!ok(result)) return result;
  console.log("LOOP", result);
  const context: LLMContent[] = [];
  if (result.outcomes) {
    context.push(result.outcomes);
  }
  let route = result.href;
  if (!route || route === "/") {
    route = "context";
  }
  return { [route]: context };
}

async function describe(
  { inputs: { config$prompt, ...rest } }: { inputs: AgentInputs },
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
) {
  const flags = await readFlags(moduleArgs);
  const uiSchemas = computeAgentSchema(flags, rest);
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
        ...uiSchemas,
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

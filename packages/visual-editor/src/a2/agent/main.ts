/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BehaviorSchema,
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
  SchemaEnumValue,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { Params } from "../a2/common.js";
import { Template } from "../a2/template.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { Loop } from "./loop.js";
import { UIType } from "./types.js";
import type { ModelConstraint } from "./functions/generate.js";

export { invoke as default, computeAgentSchema, describe };

export type AgentInputs = {
  config$prompt: LLMContent;
  "b-ui-enable": UIType;
  "b-ui-prompt": LLMContent;
  "b-si-instruction"?: string;
  "b-si-constraint": ModelConstraint;
} & Params;

type AgentOutputs = {
  [key: string]: LLMContent[];
};

const UI_TYPES = [
  {
    id: "none",
    title: "None",
    icon: "close",
    description: "This step can't interact with user",
  },
  {
    id: "chat",
    title: "Chat",
    icon: "chat_mirror",
    description: "This step can chat with the user",
  },
  {
    id: "a2ui",
    title: "Interactive UI",
    icon: "web",
    description: "This step can generate interactive UI",
  },
] satisfies SchemaEnumValue[];

const UI_TYPE_VALUES = UI_TYPES.map((type) => type.id);

function computeAgentSchema({
  "b-ui-enable": enableUI = "none",
}: Record<string, unknown>) {
  enableUI = UI_TYPE_VALUES.includes(enableUI as string) ? enableUI : "none";
  const uiPromptSchema: Schema["properties"] =
    enableUI === "a2ui"
      ? {
          "b-ui-prompt": {
            type: "object",
            behavior: ["llm-content", "config", "hint-advanced"],
            title: "UI Layout instructions",
            description: "Instructions for UI layout",
          },
        }
      : {};
  const chatSchema: BehaviorSchema[] =
    enableUI !== "none" ? ["hint-chat-mode"] : [];

  return {
    hints: chatSchema,
    props: {
      config$prompt: {
        type: "object",
        behavior: ["llm-content", "config", "hint-preview"],
        title: "Objective",
        description: "The objective for the agent",
      },
      "b-ui-enable": {
        type: "string",
        enum: UI_TYPES,
        title: "User interaction",
        description: "Specifies the type of user interaction",
        behavior: ["config", "hint-advanced", "reactive"],
      },
      ...uiPromptSchema,
    } as Schema["properties"],
  };
}

async function invoke(
  {
    config$prompt: objective,
    "b-ui-enable": uiType = "none",
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
  uiType = UI_TYPE_VALUES.includes(uiType) ? uiType : "none";
  const loop = new Loop(caps, moduleArgs);
  const result = await loop.run({
    objective,
    params,
    extraInstruction,
    uiType,
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
  caps: Capabilities
) {
  const uiSchemas = computeAgentSchema(rest);
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
        ...uiSchemas.props,
        ...template.schemas(),
      },
      behavior: ["at-wireable", ...uiSchemas.hints],
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

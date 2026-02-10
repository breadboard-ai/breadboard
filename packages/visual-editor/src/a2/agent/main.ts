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
import { createAgentConfigurator } from "./agent-function-configurator.js";
import { readFlags } from "../a2/settings.js";
import { conformGeminiBody, streamGenerateContent } from "../a2/gemini.js";
import { callGeminiImage } from "../a2/image-utils.js";
import { callVideoGen } from "../video-generator/main.js";
import { callAudioGen } from "../audio-generator/main.js";
import { callMusicGen } from "../music-generator/main.js";
import { Generators } from "./types.js";
import { invokeAgentAdk } from "./agent-adk.js";

export { invoke as default, computeAgentSchema, describe };

const generators: Generators = {
  streamContent: streamGenerateContent,
  conformBody: conformGeminiBody,
  callImage: callGeminiImage,
  callVideo: callVideoGen,
  callAudio: callAudioGen,
  callMusic: callMusicGen,
};

export type AgentInputs = {
  config$prompt: LLMContent;
  "b-ui-consistent": boolean;
  "b-ui-prompt": LLMContent;
} & Params;

export type AgentOutputs = {
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

export async function toAgentOutputs(results?: LLMContent, href?: string): Promise<AgentOutputs> {
  const context: LLMContent[] = [];
  if (results) {
    context.push(results);
  }
  if (!href || href === "/") {
    href = "context";
  }
  return {
    [href]: context,
  };
}

async function invokeAgent(
  {
    config$prompt: objective,
    "b-ui-consistent": enableA2UI = false,
    "b-ui-prompt": uiPrompt,
    ...rest
  }: AgentInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AgentOutputs>> {
  const params = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith("p-z-"))
  );
  const configureFn = createAgentConfigurator(caps, moduleArgs, generators);
  const loop = new Loop(caps, moduleArgs, configureFn);
  const result = await loop.run({
    objective,
    params,
    uiType: enableA2UI ? "a2ui" : "chat",
    uiPrompt,
  });
  if (!ok(result)) return result;
  console.log("LOOP", result);
  return toAgentOutputs(result.outcomes, result.href);
}

async function invoke(
  inputs: AgentInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AgentOutputs>> {
  const flags = await moduleArgs.context.flags?.flags();
  const opalAdkEnabled = flags?.opalAdk || false;

  if (opalAdkEnabled) {
    return invokeAgentAdk(inputs, caps, moduleArgs);
  } else {
    return invokeAgent(inputs, caps, moduleArgs);
  }
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

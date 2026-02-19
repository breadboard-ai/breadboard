/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LLMContent,
  Outcome,
  RuntimeFlags,
  Schema,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { Params } from "../a2/common.js";
import type { ProgressReporter } from "./types.js";
import { Template } from "../a2/template.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { buildAgentRun } from "./loop-setup.js";
import { createAgentConfigurator } from "./agent-function-configurator.js";
import { readFlags } from "../a2/settings.js";
import { conformGeminiBody, streamGenerateContent } from "../a2/gemini.js";
import { callGeminiImage } from "../a2/image-utils.js";
import { callVideoGen } from "../video-generator/main.js";
import { callAudioGen } from "../audio-generator/main.js";
import { callMusicGen } from "../music-generator/main.js";
import { Generators } from "./types.js";
import { invokeAgentAdk } from "./agent-adk.js";
import { requestInput } from "../request-input.js";

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

export async function toAgentOutputs(
  results?: LLMContent,
  href?: string
): Promise<AgentOutputs> {
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
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AgentOutputs>> {
  const params = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith("p-z-"))
  );
  const configureFn = createAgentConfigurator(moduleArgs, generators);

  // Create a run handle for this content agent execution
  const handle = moduleArgs.agentService.startRun({
    kind: "content",
    objective,
  });

  const setup = await buildAgentRun({
    objective,
    params,
    moduleArgs,
    configureFn,
    uiType: enableA2UI ? "a2ui" : "chat",
    uiPrompt,
    sink: handle.sink,
  });
  if (!ok(setup)) {
    moduleArgs.agentService.endRun(handle.runId);
    return setup;
  }

  const { loop, runArgs, progress, runStateManager, choicePresenter } = setup;

  // Maps event-layer callIds → progress-manager callIds.
  // Both sides generate UUIDs independently; this map correlates them.
  const callIdMap = new Map<string, string>();

  // Maps event-layer callIds → real ProgressReporters from progress.functionCall().
  // Subagent events dispatch to these reporters.
  const reporterMap = new Map<string, ProgressReporter>();

  // Wire consumer handlers to progress manager and run state manager
  handle.events
    .on("start", (event) => {
      progress.startAgent(event.objective);
    })
    .on("finish", () => {
      progress.finish();
    })
    .on("content", (event) => {
      runStateManager.pushContent(event.content);
    })
    .on("thought", (event) => {
      progress.thought(event.text);
    })
    .on("functionCall", (event) => {
      const { callId: progressCallId, reporter } = progress.functionCall(
        { functionCall: { name: event.name, args: event.args } },
        event.icon,
        event.title
      );
      callIdMap.set(event.callId, progressCallId);
      if (reporter) {
        reporterMap.set(event.callId, reporter);
      }
    })
    .on("functionCallUpdate", (event) => {
      const progressCallId = callIdMap.get(event.callId) ?? event.callId;
      progress.functionCallUpdate(progressCallId, event.status, event.opts);
    })
    .on("functionResult", (event) => {
      const progressCallId = callIdMap.get(event.callId) ?? event.callId;
      progress.functionResult(progressCallId, event.content);
      callIdMap.delete(event.callId);
      reporterMap.delete(event.callId);
    })
    .on("turnComplete", () => {
      runStateManager.completeTurn();
    })
    .on("sendRequest", (event) => {
      progress.sendRequest(event.model, event.body);
      runStateManager.captureRequestBody(event.model, event.body);
    })
    .on("subagentAddJson", (event) => {
      reporterMap
        .get(event.callId)
        ?.addJson(event.title, event.data, event.icon);
    })
    .on("subagentError", (event) => {
      reporterMap.get(event.callId)?.addError(event.error);
    })
    .on("subagentFinish", (event) => {
      reporterMap.get(event.callId)?.finish();
    })
    .on("waitForInput", (event) => {
      return requestInput(moduleArgs, {
        properties: {
          input: {
            type: "object",
            behavior: ["transient", "llm-content", "hint-required"],
            format: event.inputType,
          },
        },
      }) as Promise<unknown>;
    })
    .on("waitForChoice", (event) => {
      const promptText = event.prompt.parts
        .filter((p): p is { text: string } => "text" in p)
        .map((p) => p.text)
        .join("\n");
      const choices = event.choices.map((c) => ({
        id: c.id,
        label: c.content.parts
          .filter((p): p is { text: string } => "text" in p)
          .map((p) => p.text)
          .join("\n"),
      }));
      return choicePresenter.presentChoices(
        promptText,
        choices,
        event.selectionMode,
        event.layout,
        event.noneOfTheAboveLabel
      ) as Promise<unknown>;
    });

  const result = await loop.run(runArgs);
  moduleArgs.agentService.endRun(handle.runId);
  if (!ok(result)) return result;
  console.log("LOOP", result);
  return toAgentOutputs(result.outcomes, result.href);
}

async function invoke(
  inputs: AgentInputs,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AgentOutputs>> {
  const flags = await moduleArgs.context.flags?.flags();
  const opalAdkEnabled = flags?.opalAdk || false;

  if (opalAdkEnabled) {
    return invokeAgentAdk(inputs, moduleArgs);
  } else {
    return invokeAgent(inputs, moduleArgs);
  }
}

async function describe(
  { inputs: { config$prompt, ...rest } }: { inputs: AgentInputs },
  moduleArgs: A2ModuleArgs
) {
  const flags = await readFlags(moduleArgs);
  const uiSchemas = computeAgentSchema(flags, rest);
  const template = new Template(config$prompt, moduleArgs.context.currentGraph);
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

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ConsentRequest,
  ConsentUIType,
  LLMContent,
  Outcome,
  RuntimeFlags,
  Schema,
} from "@breadboard-ai/types";
import { ok, err } from "@breadboard-ai/utils";
import { Params } from "../a2/common.js";
import type { ProgressReporter } from "./types.js";
import { Template } from "../a2/template.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { buildAgentRun } from "./loop-setup.js";
import type { LocalAgentRun } from "./local-agent-run.js";
import { SSEAgentRun } from "./sse-agent-run.js";
import { resolveToSegments } from "./resolve-to-segments.js";
import { ConsoleProgressManager } from "./console-progress-manager.js";
import { getCurrentStepState } from "./progress-work-item.js";
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

  // Check if we're in remote mode by testing for the remote base URL.
  // In remote mode, resolve templates to segments for the wire protocol.
  // In local mode, pass the raw objective for in-process toPidgin.
  const isRemote = moduleArgs.agentService.isRemote;

  let handle;
  if (isRemote) {
    // Resolve templates into segments for the wire protocol.
    const resolution = await resolveToSegments(objective, params, moduleArgs);
    if (!ok(resolution)) {
      return err(resolution.$error);
    }
    handle = moduleArgs.agentService.startRun({
      kind: "content",
      segments: resolution.segments,
      flags: resolution.flags,
    });
  } else {
    handle = moduleArgs.agentService.startRun({
      kind: "content",
      objective,
    });
  }

  // --- Remote mode: server runs the loop, we consume SSE events ---
  if (handle instanceof SSEAgentRun) {
    return invokeRemoteAgent(handle, moduleArgs);
  }

  // --- Local mode: build and run the loop in-process ---
  const localHandle = handle as LocalAgentRun;

  const configureFn = createAgentConfigurator(
    moduleArgs,
    generators,
    localHandle.sink
  );

  const setup = await buildAgentRun({
    objective,
    params,
    moduleArgs,
    configureFn,
    uiType: enableA2UI ? "a2ui" : "chat",
    uiPrompt,
    sink: localHandle.sink,
  });
  if (!ok(setup)) {
    moduleArgs.agentService.endRun(handle.runId);
    return setup;
  }

  const { loop, runArgs, progress, runStateManager, choicePresenter } = setup;

  // Maps event-layer callIds → progress-manager callIds.
  const callIdMap = new Map<string, string>();
  const reporterMap = new Map<string, ProgressReporter>();

  localHandle.events
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
    })
    .on("queryConsent", async (event) => {
      const consent = await moduleArgs.getConsentController().queryConsent(
        {
          type: event.consentType,
          scope: event.scope,
          graphUrl: event.graphUrl,
        } as ConsentRequest,
        ConsentUIType.MODAL
      );
      return consent;
    });

  const result = await loop.run(runArgs);
  moduleArgs.agentService.endRun(handle.runId);
  if (!ok(result)) return result;
  console.log("LOOP", result);
  return toAgentOutputs(result.outcomes, result.href);
}

/**
 * Remote agent run: the server runs the loop, we consume SSE events.
 *
 * This is a lightweight path that skips all the heavy local deps
 * (AgentFileSystem, PidginTranslator, AgentUI) — those run server-side.
 * We only set up a ConsoleProgressManager for UI reporting.
 */
async function invokeRemoteAgent(
  handle: SSEAgentRun,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<AgentOutputs>> {
  const { consoleEntry, appScreen } = getCurrentStepState(moduleArgs);
  const progress = new ConsoleProgressManager(consoleEntry, appScreen);

  const callIdMap = new Map<string, string>();
  const reporterMap = new Map<string, ProgressReporter>();

  // The `complete` event carries the final AgentResult with outcomes.
  // This mirrors `loop.run()` returning `controller.result` in local mode.
  let remoteResult: { success: boolean; outcomes?: LLMContent } | undefined;

  handle.events
    .on("start", (event) => {
      progress.startAgent(event.objective);
    })
    .on("finish", () => {
      progress.finish();
    })
    .on("complete", (event) => {
      remoteResult = event.result;
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
    .on("sendRequest", (event) => {
      progress.sendRequest(event.model, event.body);
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
    });

  await handle.connect();
  moduleArgs.agentService.endRun(handle.runId);

  return toAgentOutputs(remoteResult?.outcomes);
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

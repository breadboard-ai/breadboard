/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { Params } from "../a2/common.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { AgentFileSystem } from "./file-system.js";
import { PidginTranslator } from "./pidgin-translator.js";
import { AgentUI } from "./ui.js";
import { RunStateManager } from "./run-state-manager.js";
import { ConsoleProgressManager } from "./console-progress-manager.js";
import { llm } from "../a2/utils.js";
import {
  FunctionGroupConfigurator,
  LoopHooks,
  ProgressReporter,
  UIType,
} from "./types.js";
import { Loop, AgentRunArgs } from "./loop.js";
import type { AgentEventSink } from "./agent-event-sink.js";

export { buildAgentRun, buildHooksFromSink };

/**
 * Builds everything needed for a full-featured agent run:
 * deps, function groups, hooks, and Loop args.
 *
 * This centralizes the "traditional agent setup" that was previously
 * inside the Loop constructor and run() method. It:
 * 1. Creates AgentFileSystem, PidginTranslator, AgentUI, RunStateManager
 * 2. Translates the objective through Pidgin
 * 3. Calls the configurator to build function groups
 * 4. Composes hooks from ConsoleProgressManager and RunStateManager
 * 5. Wires up onSuccess/onFailure to set Loop termination state
 *
 * Use this for the content generation agent or any agent that needs
 * the full infrastructure. For lightweight agents (graph editing),
 * just create a Loop and pass function groups directly.
 */
async function buildAgentRun(args: {
  objective: LLMContent;
  params: Params;
  moduleArgs: A2ModuleArgs;
  configureFn: FunctionGroupConfigurator;
  uiType?: UIType;
  uiPrompt?: LLMContent;
  sink: AgentEventSink;
}): Promise<
  Outcome<{
    loop: Loop;
    runArgs: AgentRunArgs;
    progress: ConsoleProgressManager;
    runStateManager: RunStateManager;
  }>
> {
  const {
    objective,
    params,
    moduleArgs,
    configureFn,
    uiType = "chat",
    uiPrompt,
    sink,
  } = args;

  // 1. Create deps (previously done in Loop constructor)
  const fileSystem = new AgentFileSystem({
    context: moduleArgs.context,
    memoryManager: moduleArgs.agentContext.memoryManager,
  });
  const translator = new PidginTranslator(moduleArgs, fileSystem);
  const ui = new AgentUI(moduleArgs, translator);
  const runStateManager = new RunStateManager(
    moduleArgs.agentContext,
    fileSystem
  );
  ui.onA2UIRender = (messages) => runStateManager.pushA2UISurface(messages);

  // 2. Translate the objective through Pidgin
  const objectivePidgin = await translator.toPidgin(objective, params, true);
  if (!ok(objectivePidgin)) return objectivePidgin;

  fileSystem.setUseMemory(objectivePidgin.useMemory);

  // 3. Start or resume the run
  const stepId = moduleArgs.context.currentStep?.id;
  const objectiveContent =
    llm`<objective>${objectivePidgin.text}</objective>`.asContent();

  const runtimeFlags = await moduleArgs.context.flags?.flags();
  const enableResumeAgentRun = runtimeFlags?.enableResumeAgentRun ?? false;

  const { contents } = enableResumeAgentRun
    ? runStateManager.startOrResume(stepId, objectiveContent)
    : runStateManager.startFresh(stepId, objectiveContent);

  // 4. Create the Loop and wire up termination callbacks
  const loop = new Loop(moduleArgs);

  const onSuccess = async (
    href: string,
    objectiveOutcome: string
  ): Promise<Outcome<void>> => {
    const originalRoute = fileSystem.getOriginalRoute(href);
    if (!ok(originalRoute)) return originalRoute;

    const outcomes = await translator.fromPidginString(objectiveOutcome);
    if (!ok(outcomes)) return outcomes;

    const intermediateFiles = [...fileSystem.files.keys()];
    const errors: string[] = [];
    const intermediate = (
      await Promise.all(
        intermediateFiles.map(async (file) => {
          const content = await translator.fromPidginFiles([file]);
          if (!ok(content)) {
            errors.push(content.$error);
            return [];
          }
          return { path: file, content };
        })
      )
    ).flat();
    if (errors.length > 0) {
      return err(errors.join(","));
    }

    runStateManager.complete();
    loop.controller.terminate({
      success: true,
      href: originalRoute,
      outcomes,
      intermediate,
    });
  };

  const onFailure = (objectiveOutcome: string): void => {
    loop.controller.terminate(runStateManager.fail(err(objectiveOutcome)));
  };

  // 5. Call the configurator to build function groups
  const functionGroupsResult = await configureFn(
    { fileSystem, translator, ui },
    {
      uiType,
      useMemory: objectivePidgin.useMemory,
      useNotebookLM: objectivePidgin.useNotebookLM,
      objective,
      uiPrompt,
      params,
      onSuccess,
      onFailure,
    }
  );
  if (!ok(functionGroupsResult)) return functionGroupsResult;

  // 6. Compose hooks from sink
  const hooks = buildHooksFromSink(sink);

  // 7. Assemble the run args
  const runArgs: AgentRunArgs = {
    objective,
    functionGroups: functionGroupsResult,
    hooks,
    contents,
    customTools: objectivePidgin.tools,
  };

  return { loop, runArgs, progress: ui.progress, runStateManager };
}

/**
 * Builds LoopHooks that emit AgentEvents through a sink.
 *
 * Each hook emits an AgentEvent instead of calling managers directly.
 * The consumer on the other end of the sink dispatches events to the
 * appropriate managers (ConsoleProgressManager, RunStateManager).
 *
 * The returned `reporter` is a proxy that emits `subagentAddJson`,
 * `subagentError`, and `subagentFinish` events. This preserves nested
 * progress reporting for sub-processes (image/video/audio/music gen)
 * when the agent runs on the backend.
 */
function buildHooksFromSink(sink: AgentEventSink): LoopHooks {
  return {
    onStart(objective: LLMContent) {
      sink.emit({ type: "start", objective });
    },
    onFinish() {
      sink.emit({ type: "finish" });
    },
    onContent(content: LLMContent) {
      sink.emit({ type: "content", content });
    },
    onThought(text: string) {
      sink.emit({ type: "thought", text });
    },
    onFunctionCall(part, icon?, title?) {
      const callId = crypto.randomUUID();
      sink.emit({
        type: "functionCall",
        callId,
        name: part.functionCall.name,
        args: (part.functionCall.args ?? {}) as Record<string, unknown>,
        icon: typeof icon === "string" ? icon : undefined,
        title,
      });
      // Return a proxy reporter that emits subagent events through the sink.
      // Function handlers call addJson/addError/finish as usual — the events
      // travel through the event layer to the consumer.
      const reporter: ProgressReporter = {
        addJson(jsonTitle, data, jsonIcon?) {
          sink.emit({
            type: "subagentAddJson",
            callId,
            title: jsonTitle,
            data,
            icon: jsonIcon,
          });
        },
        addError(error) {
          sink.emit({ type: "subagentError", callId, error });
          return error;
        },
        finish() {
          sink.emit({ type: "subagentFinish", callId });
        },
      };
      return { callId, reporter };
    },
    onFunctionCallUpdate(callId, status, opts?) {
      sink.emit({ type: "functionCallUpdate", callId, status, opts });
    },
    onFunctionResult(callId, content) {
      sink.emit({ type: "functionResult", callId, content });
    },
    onTurnComplete() {
      sink.emit({ type: "turnComplete" });
    },
    onSendRequest(model, body) {
      sink.emit({ type: "sendRequest", model, body });
    },
  };
}

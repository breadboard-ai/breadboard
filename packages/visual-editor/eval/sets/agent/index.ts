/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils";
import { session } from "../../eval.js";
import {
  SimulatedUserChatManager,
  createSimulatedUserConfigurator,
} from "../../simulated-user.js";
import type {
  FunctionGroupConfigurator,
  LoopDeps,
  FunctionGroupConfiguratorFlags,
  FunctionGroup,
  ProgressReporter,
} from "../../../src/a2/agent/types.js";

session({ name: "Agent" }, async (session) => {
  // Need to import dynamically to let the mocks do their job.
  const { buildAgentRun } = await import("../../../src/a2/agent/loop-setup.js");
  const { createAgentConfigurator } =
    await import("../../../src/a2/agent/agent-function-configurator.js");
  const { streamGenerateContent, conformGeminiBody } =
    await import("../../../src/a2/a2/gemini.js");
  let imageCount = 1;
  let videoCount = 1;
  let audioCount = 1;
  let musicCount = 1;

  const fakeContent = (type: string, mimeType: string, count: number) => ({
    parts: [
      {
        storedData: {
          handle: `https://example.com/fake-${type}-${count}`,
          mimeType,
        },
      },
    ],
  });

  const generators = {
    streamContent: streamGenerateContent,
    conformBody: conformGeminiBody,
    callImage: async () => [fakeContent("image", "image/png", imageCount++)],
    callVideo: async () => fakeContent("video", "video/mp4", videoCount++),
    callAudio: async () => fakeContent("audio", "audio/mp3", audioCount++),
    callMusic: async () => fakeContent("music", "audio/mp3", musicCount++),
  };

  function composeConfigurators(
    ...configurators: FunctionGroupConfigurator[]
  ): FunctionGroupConfigurator {
    return async (deps: LoopDeps, flags: FunctionGroupConfiguratorFlags) => {
      const groups: FunctionGroup[] = [];
      for (const configurator of configurators) {
        const result = await configurator(deps, flags);
        if (!ok(result)) return result;
        groups.push(...result);
      }
      return groups;
    };
  }

  async function evalObjective(filename: string, only = false) {
    const { objective, title, userObjective } = await import(filename);
    const params: Parameters<typeof session.eval> = [
      title,
      async ({ moduleArgs }) => {
        const handle = moduleArgs.agentService.startRun({
          kind: "content-eval",
          objective,
        });

        const agentConfigurator = createAgentConfigurator(
          moduleArgs,
          generators,
          handle.sink
        );

        let configureFn: FunctionGroupConfigurator;
        let uiType: "chat" | "simulated" = "chat";
        let simulatedUser: SimulatedUserChatManager | null = null;

        if (userObjective) {
          simulatedUser = new SimulatedUserChatManager(
            userObjective,
            moduleArgs
          );
          const simulatedUserConfigurator =
            createSimulatedUserConfigurator(simulatedUser);
          configureFn = composeConfigurators(
            agentConfigurator,
            simulatedUserConfigurator
          );
          uiType = "simulated";
        } else {
          configureFn = agentConfigurator;
        }

        const setup = await buildAgentRun({
          objective,
          params: {},
          moduleArgs,
          configureFn,
          uiType,
          sink: handle.sink,
        });
        if (!ok(setup)) {
          moduleArgs.agentService.endRun(handle.runId);
          return setup;
        }
        const { loop, runArgs, progress, runStateManager } = setup;

        // Maps event-layer callIds → progress-manager callIds.
        const callIdMap = new Map<string, string>();
        const reporterMap = new Map<string, ProgressReporter>();

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
            progress.functionCallUpdate(
              progressCallId,
              event.status,
              event.opts
            );
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
          });

        const result = await loop.run(runArgs);
        moduleArgs.agentService.endRun(handle.runId);

        if (simulatedUser) {
          await simulatedUser.close();
        }

        return result;
      },
    ];

    if (only) {
      session.evalOnly(...params);
    } else {
      session.eval(...params);
    }
  }

  await evalObjective("./halloween-mugs.js");
  await evalObjective("./funny-joke.js");
  await evalObjective("./marketing-pitch.js");
  await evalObjective("./impossible-task.js");
  await evalObjective("./print-or-display.js");
  await evalObjective("./json-output.js");
  await evalObjective("./blog-post-writer.js");
  await evalObjective("./alien-names.js");
  await evalObjective("./state-detector.js");
  await evalObjective("./news-tracker.js");
  await evalObjective("./get-recipe.js");
  await evalObjective("./recipe-assistant.js");
  await evalObjective("./content-guardrails.js");
});

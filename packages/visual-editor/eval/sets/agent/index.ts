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
        const agentConfigurator = createAgentConfigurator(
          moduleArgs,
          generators
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
        });
        if (!ok(setup)) return setup;
        const { loop, runArgs } = setup;
        const result = await loop.run(runArgs);

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
});

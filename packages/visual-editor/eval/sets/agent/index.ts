/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { session } from "../../eval.js";

session({ name: "Agent" }, async (session) => {
  // Need to import dynamically to let the mocks do their job.
  const Loop = (await import("../../../src/a2/agent/loop.js")).Loop;
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

  async function evalObjective(filename: string, only = false) {
    const { objective, title } = await import(filename);
    const params: Parameters<typeof session.eval> = [
      title,
      async ({ caps, moduleArgs }) => {
        const configureFn = createAgentConfigurator(
          caps,
          moduleArgs,
          generators
        );
        const loop = new Loop(caps, moduleArgs, configureFn);
        return loop.run({ objective, params: {}, uiType: "chat" });
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
});

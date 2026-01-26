/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { session } from "../../eval.js";

session({ name: "Agent" }, async (session) => {
  // Need to import dynamically to let the mocks do their job.
  const Loop = (await import("../../../src/a2/agent/loop.js")).Loop;

  async function evalObjective(filename: string, only = false) {
    const { objective, title } = await import(filename);
    const params: Parameters<typeof session.eval> = [
      title,
      async ({ caps, moduleArgs }) => {
        const loop = new Loop(caps, moduleArgs);
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

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { llm } from "../src/a2/utils";
import { session } from "../scripts/eval";

config();

const apiKey = process.env.GEMINI_API_KEY;

session({ name: "Agent Loop", apiKey }, async (session) => {
  // Need to import dynamically to let the mocks do their job.
  const Loop = (await import("../src/agent/loop")).Loop;

  session.eval("Halloween Mugs", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective =
      llm`Come up with 4 ideas for Halloween-themed mugs and turn them into images that can be used as inspirations for online storefront graphics. Caption each with a witty, humorous paragraph of text suitable for an instagram post`.asContent();
    const result = await loop.run(objective, {});
    console.log("RESULT", result);
  });
  session.eval("Funny Joke", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective = llm`Make a funny joke`.asContent();
    const result = await loop.run(objective, {});
    console.log("RESULT", result);
  });
  //   session.eval(async ({ caps, moduleArgs }) => {
  //     const loop = new Loop(caps, moduleArgs);
  //     const objective =
  //       llm`Given a product, come up with a rubric for evaulating a marketing pitch for the rubric, then generate four different marketing pitches for the product, evaluate each using the rubric, and return the winning pitch

  // Product: Bluetooth-enabled Electric Toothbrush`.asContent();
  //     const result = await loop.run(objective, {});
  //     console.log("RESULT", result);
  //   });
});

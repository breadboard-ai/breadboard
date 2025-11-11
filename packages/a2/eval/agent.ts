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
    return loop.run(objective, {});
  });
  session.eval("Funny Joke", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective = llm`Make a funny joke`.asContent();
    return loop.run(objective, {});
  });
  session.eval("Marketing Pitch w/Critique", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective =
      llm`Given a product, come up with a rubric for evaluating a marketing pitch for the rubric, then generate four different marketing pitches for the product, evaluate each using the rubric, and return the winning pitch

  Product: Bluetooth-enabled Electric Toothbrush`.asContent();
    return loop.run(objective, {});
  });
  session.eval("Impossible chat", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective =
      llm`Ask the user for their name and location and then compose a poem based on that information`.asContent();
    return loop.run(objective, {});
  });

  session.eval("Print or display", async ({ caps, moduleArgs }) => {
    const loop = new Loop(caps, moduleArgs);
    const objective = llm`
Depending on the directive below, either go to <a href="/print">Print</a> to print the page or to <a href="/display">Display</a> to display the page

Directive:

Could you please print the page?`.asContent();
    return loop.run(objective, {});
  });
});

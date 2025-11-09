/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { EvalHarness } from "./eval-harness";
import { llm } from "../src/a2/utils";

config();

const apiKey = process.env.GEMINI_API_KEY;

const harness = new EvalHarness({ name: "eval-agent", apiKey });
await harness.eval(async ({ caps, moduleArgs }) => {
  // Need to import dynamically to let the mocks do their job.
  const Loop = (await import("../src/agent/loop")).Loop;

  const loop = new Loop(caps, moduleArgs);
  const objective =
    llm`<objective>Come up with 4 ideas for Halloween-themed mugs and turn them into images that can be used as inspirations for online storefront graphics. Caption each with a witty, humorous paragraph of text suitable for an instagram post</objective>`.asContent();
  const result = await loop.run(objective, {});
  console.log("RESULT", result);
});

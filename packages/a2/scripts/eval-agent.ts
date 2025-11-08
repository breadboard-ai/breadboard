/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { EvalHarness } from "../src/eval-harness";
import { llm } from "../src/a2/utils";

// @ts-expect-error "Can't define window? Haha"
globalThis.window = {
  location: new URL("https://example.com/"),
} as Window;

config();

const apiKey = process.env.GEMINI_API_KEY;

// Need to import dynamically to let the globalThis override work.
const Loop = (await import("../src/agent/loop")).Loop;

const harness = new EvalHarness({ apiKey });
const loop = new Loop(harness.caps, harness.moduleArgs);
const objective =
  llm`<objective>Come up with 4 ideas for Halloween-themed mugs and turn them into images that can be used as inspirations for online storefront graphics</objective>`.asContent();
const result = await loop.run(objective, {});
console.log(result);

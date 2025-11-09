/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { EvalHarness } from "./eval-harness";
import { llm } from "../src/a2/utils";
import { mock } from "node:test";
import { autoClearingInterval } from "./auto-clearing-interval";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const OUT_DIR = join(ROOT_DIR, "out");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}
// @ts-expect-error "Can't define window? Haha"
globalThis.window = { location: new URL("https://example.com/") } as Window;

mock.method(globalThis, "setInterval", autoClearingInterval.setInterval);

config();

const apiKey = process.env.GEMINI_API_KEY;

const harness = new EvalHarness({ name: "eval-agent", apiKey });
const har = await harness.eval(async ({ caps, moduleArgs }) => {
  // Need to import dynamically to let the mocks do their job.
  const Loop = (await import("../src/agent/loop")).Loop;

  const loop = new Loop(caps, moduleArgs);
  const objective =
    llm`<objective>Come up with 4 ideas for Halloween-themed mugs and turn them into images that can be used as inspirations for online storefront graphics. Caption each with a witty, humorous paragraph of text suitable for an instagram post</objective>`.asContent();
  const result = await loop.run(objective, {});
  console.log("RESULT", result);
});

autoClearingInterval.clearAllIntervals();

await ensureDir(OUT_DIR);

await writeFile(
  join(OUT_DIR, "har.json"),
  JSON.stringify(har, null, 2),
  "utf-8"
);

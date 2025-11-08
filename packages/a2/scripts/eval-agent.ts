/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { EvalHarness } from "../src/eval-harness";
import { llm } from "../src/a2/utils";
import { AgentFileSystem } from "../src/agent/file-system";
import { mock } from "node:test";
import { autoClearingInterval } from "./auto-clearing-interval";
import { Logger } from "./logger";
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

const logger = new Logger();

config();

const apiKey = process.env.GEMINI_API_KEY;

// Need to import dynamically to let the mocks do their job.
const Loop = (await import("../src/agent/loop")).Loop;

const fileSystem = new AgentFileSystem();
const harness = new EvalHarness({ apiKey, fileSystem, logger });
const loop = new Loop(
  harness.caps,
  harness.moduleArgs,
  fileSystem,
  harness.functionCallerFactory
);
const objective =
  llm`<objective>Come up with 4 ideas for Halloween-themed mugs and turn them into images that can be used as inspirations for online storefront graphics</objective>`.asContent();
const result = await loop.run(objective, {});
console.log("RESULT", result);

autoClearingInterval.clearAllIntervals();

await ensureDir(OUT_DIR);

await writeFile(
  join(OUT_DIR, "har.json"),
  JSON.stringify(logger.getHar(), null, 2),
  "utf-8"
);

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { readFile } from "fs/promises";
import { join } from "path";
import { a } from "./cases/a-insta-caption";
import { runInVm } from "./run-in-vm";
import { Invoke, Test } from "./types";
import { CapabilityMocksImpl } from "./capability-mocks";

config({ quiet: true });

const OUT_DIR = join(import.meta.dirname, "../out");

const { GEMINI_API_KEY } = process.env;
if (!GEMINI_API_KEY) {
  console.error(
    `  🔑 Please set GEMINI_KEY environment variable to run this app`
  );
  process.exit(1);
} else {
  console.log(`  🔑 GEMINI_KEY Acquired`);
}

const programCodePath = join(OUT_DIR, `${a.name}.js`);
const programCode = await readFile(programCodePath, "utf-8");

const testCodePath = join(OUT_DIR, `${a.name}.test.js`);
const testCode = await readFile(testCodePath, "utf-8");

const invoke = await runInVm<Invoke>(programCode);
const mocks = new CapabilityMocksImpl();

const test = await runInVm<Test>(testCode);

await test(invoke, mocks);

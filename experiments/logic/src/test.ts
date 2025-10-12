/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { runInVm } from "./run-in-vm";
import { Case, Invoke, Test } from "./types";
import { CapabilityMocksImpl } from "./capability-mocks";
import { evalSet } from "./eval-set";

const OUT_DIR = join(import.meta.dirname, "../out");

await Promise.all(evalSet.map((c) => evalOne(c)));

async function evalOne(c: Case) {
  const programCodePath = join(OUT_DIR, `${c.name}.js`);
  const programCode = await readFile(programCodePath, "utf-8");

  const testCodePath = join(OUT_DIR, `${c.name}.test.js`);
  const testCode = await readFile(testCodePath, "utf-8");

  const invoke = await runInVm<Invoke>(programCode);
  const mocks = new CapabilityMocksImpl();

  const test = await runInVm<Test>(testCode);

  await test(
    async (inputs) => {
      return invoke(inputs, mocks.capabilities);
    },
    mocks,
    {
      progress: (...params) => {
        console.log(...params);
      },
      fail: (...params) => {
        console.error(`❌`, ...params);
        throw new Error("Test failed");
      },
      success: (...params) => {
        console.log(`✅`, ...params);
      },
    }
  );
}

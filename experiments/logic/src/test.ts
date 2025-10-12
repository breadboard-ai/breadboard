/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { runInVm } from "./run-in-vm";
import { Case, Console, Invoke, Test, TestResultsReporter } from "./types";
import { CapabilityMocksImpl } from "./capability-mocks";
import { evalSet } from "./eval-set";

class Reporter implements Console, TestResultsReporter {
  readonly #logs: unknown[][] = [];

  constructor() {
    this.progress = this.progress.bind(this);
    this.fail = this.fail.bind(this);
    this.success = this.success.bind(this);

    this.log = this.log.bind(this);
    this.error = this.error.bind(this);
  }

  progress(...params: unknown[]) {
    this.#logs.push(params);
  }

  fail(...params: unknown[]) {
    this.#logs.push([`❌`, ...params]);
    throw new Error("Test failed");
  }
  success(...params: unknown[]) {
    this.#logs.push([`✅`, ...params]);
  }
  log(...params: unknown[]): void {
    this.#logs.push([`🤖`, ...params]);
  }
  error(...params: unknown[]): void {
    this.#logs.push([`🤖`, ...params]);
  }

  printLog() {
    for (const item of this.#logs) {
      console.log(...item);
    }
  }
}

const OUT_DIR = join(import.meta.dirname, "../out");

await Promise.all(evalSet.map((c) => evalOne(c)));

async function evalOne(c: Case) {
  const programCodePath = join(OUT_DIR, `${c.name}.js`);
  const programCode = await readFile(programCodePath, "utf-8");

  const testCodePath = join(OUT_DIR, `${c.name}.test.js`);
  const testCode = await readFile(testCodePath, "utf-8");

  let test;
  try {
    test = await runInVm<Test>(testCode);
  } catch (e) {
    console.log(`Test failed to compile`, e);
    return;
  }

  let invoke;
  try {
    invoke = await runInVm<Invoke>(programCode);
  } catch (e) {
    console.log(`Invoke failed to compile`, e);
    return;
  }

  const reporter = new Reporter();
  const mocks = new CapabilityMocksImpl(reporter);

  try {
    await test(
      async (inputs) => {
        return invoke(inputs, mocks.capabilities);
      },
      mocks,
      reporter
    );
    reporter.printLog();
    console.log(`-- "${c.name}" Test Succeeded\n\n`);
  } catch {
    reporter.printLog();
    console.log(`-- "${c.name}" Test failed\n\n`);
  }
}

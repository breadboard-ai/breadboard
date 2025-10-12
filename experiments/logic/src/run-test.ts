/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { prepareToRunInVM } from "./run-in-vm";
import { Case, Console, Invoke, Test, TestResultsReporter } from "./types";
import { CapabilityMocksImpl } from "./capability-mocks";

export { runTest };

export type TestResult = {
  readonly logs: ReadonlyArray<ReadonlyArray<unknown>>;
  readonly isError: boolean;
};

class TestFailedException extends Error {}

class Reporter implements Console, TestResultsReporter, TestResult {
  readonly logs: unknown[][] = [];
  isError = false;

  constructor() {
    this.progress = this.progress.bind(this);
    this.fail = this.fail.bind(this);
    this.success = this.success.bind(this);

    this.log = this.log.bind(this);
    this.error = this.error.bind(this);
  }

  progress(...params: unknown[]) {
    this.logs.push(params);
  }

  fail(...params: unknown[]) {
    this.logs.push([`❌`, ...params]);
    this.isError = true;
    throw new TestFailedException();
  }
  success(...params: unknown[]) {
    this.logs.push([`✅`, ...params]);
  }
  log(...params: unknown[]): void {
    this.logs.push([`🤖`, ...params]);
  }
  error(...params: unknown[]): void {
    this.isError = true;
    this.logs.push([`🤖`, ...params]);
  }
}

const OUT_DIR = join(import.meta.dirname, "../out");

async function runTest(c: Case): Promise<TestResult> {
  const programCodePath = join(OUT_DIR, `${c.name}.js`);
  const programCode = await readFile(programCodePath, "utf-8");

  const testCodePath = join(OUT_DIR, `${c.name}.test.js`);
  const testCode = await readFile(testCodePath, "utf-8");
  const reporter = new Reporter();

  let test;
  try {
    test = await prepareToRunInVM<Test>(testCode);
  } catch (e) {
    reporter.error(`Test failed to compile`, e);
    return reporter;
  }

  let invoke;
  try {
    invoke = await prepareToRunInVM<Invoke>(programCode);
  } catch (e) {
    reporter.error(`Program failed to compile`, e);
    return reporter;
  }

  const mocks = new CapabilityMocksImpl(reporter);

  try {
    await test(
      async (inputs) => {
        return invoke(inputs, mocks.capabilities);
      },
      mocks,
      reporter
    );
    reporter.log(`-- "${c.name}" Test Succeeded\n\n`);
    return reporter;
  } catch (e) {
    reporter.error(`-- "${c.name}" Test failed\n\n`);
    if (!(e instanceof TestFailedException)) {
      reporter.error(e);
    }
    return reporter;
  }
}

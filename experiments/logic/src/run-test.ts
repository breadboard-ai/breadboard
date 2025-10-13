/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { prepareToRunInVM } from "./run-in-vm";
import { Case, Console, Invoke, Test, TestResultsReporter } from "./types";
import { CapabilityMocksImpl } from "./capability-mocks";
import { copy, read, remove, write } from "./file-ops";

export { runTest };

export type TestResult = {
  readonly logs: ReadonlyArray<ReadonlyArray<unknown>>;
  getLogAsString(): string;
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

  getLogAsString(): string {
    const lines: string[] = [];
    for (const item of this.logs) {
      const objects: string[] = [];
      for (const o of item) {
        if (typeof o === "string") {
          objects.push(o);
        } else {
          objects.push(JSON.stringify(o, null, 2));
        }
      }
      lines.push(objects.join(" "));
    }
    return lines.join("\n");
  }
}

async function runTest(c: Case): Promise<TestResult> {
  const result = await getTestResult(c);
  if (result.isError) {
    await write(c, "errors", result.getLogAsString());
  } else {
    // await remove(c, "draft");
    await remove(c, "errors");
    await copy(c, "draft", "final");
  }
  return result;
}

async function getTestResult(c: Case): Promise<TestResult> {
  const draftCode = await read(c, "draft");

  const testCode = await read(c, "test");
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
    invoke = await prepareToRunInVM<Invoke>(draftCode);
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

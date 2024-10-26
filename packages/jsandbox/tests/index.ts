/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { loadRuntime, RunModuleManager } from "../src/node.js";
import { deepStrictEqual } from "node:assert";

async function run(
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const wasm = await loadRuntime();
  const manager = new RunModuleManager(wasm);
  return manager.runModule(code, inputs);
}

describe("runtime", () => {
  test("can run a simple module", async () => {
    deepStrictEqual(
      await run(
        `export default function() {
        return { result: "HELLO" }
      }`
      ),
      { result: "HELLO" }
    );
  });

  test("can accept arguments", async () => {
    deepStrictEqual(
      await run(
        `export default function({test}) {
        return { result: test }
      }`,
        { test: "HELLO" }
      ),
      { result: "HELLO" }
    );
  });
});

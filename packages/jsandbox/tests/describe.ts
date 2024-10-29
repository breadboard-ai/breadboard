/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import test, { describe } from "node:test";
import { loadRuntime, RunModuleManager } from "../src/node.js";

async function describeModule(
  modules: Record<string, string>,
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const wasm = await loadRuntime();
  const manager = new RunModuleManager(wasm);
  return manager.runModule("describe", "test", modules, code, inputs);
}

describe("custom describers", () => {
  test("can run", async () => {
    deepStrictEqual(
      await describeModule(
        {},
        `
export { describe };

function describe() {
  return { inputSchema: {}, outputSchema: {} }
}

export default function() {
  return { result: foo() }
}`
      ),
      { inputSchema: {}, outputSchema: {} }
    );
  });
});

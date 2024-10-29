/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import test, { describe } from "node:test";
import { loadRuntime, NodeModuleManager } from "../src/node.js";
import { DescriberInputs } from "../src/types.js";

async function describeModule(
  code: string,
  inputs: DescriberInputs
): Promise<Record<string, unknown>> {
  const wasm = await loadRuntime();
  const manager = new NodeModuleManager(wasm, { test: code });
  return manager.describe("test", inputs);
}

describe("custom describers", () => {
  test("can run", async () => {
    deepStrictEqual(
      await describeModule(
        `
export { describe };

function describe() {
  return { inputSchema: {}, outputSchema: {} }
}

export default function() {
  return { result: foo() }
}`,
        {}
      ),
      { inputSchema: {}, outputSchema: {} }
    );
  });
});

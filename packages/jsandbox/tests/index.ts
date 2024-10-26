/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { loadRuntime, RunModuleManager } from "../src/node.js";
import { deepStrictEqual } from "node:assert";

describe("runtime", () => {
  test("can run a simple module", async () => {
    const wasm = await loadRuntime();
    const manager = new RunModuleManager(wasm);
    const result = await manager.runModule(
      `
export default function() {
  return { result: "HELLO" }
}`,
      {}
    );
    deepStrictEqual(result, { result: "HELLO" });
  });
});

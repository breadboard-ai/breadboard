/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import test, { describe } from "node:test";
import { Capabilities } from "../src/capabilities.js";
import { loadRuntime, NodeModuleManager } from "../src/node.js";

async function run(
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const invocationId = crypto.randomUUID();
  Capabilities.instance().install(invocationId, {
    fetch: async (invocationId, inputs) => inputs,
  });

  const wasm = await loadRuntime();
  const manager = new NodeModuleManager(wasm);
  const outputs = await manager.invoke(
    invocationId,
    { test: code },
    "test",
    inputs
  );

  Capabilities.instance().uninstall(invocationId);
  return outputs;
}

describe("can import capabilities", () => {
  test('can import "@fetch" module', async () => {
    const result = await run(`import fetch from "@fetch";
      export default function() {
        return { fetch: typeof fetch }
      }`);
    deepStrictEqual(result, { fetch: "function" });
  });

  test('can call fetch from "@fetch"', async () => {
    const result = await run(`import fetch from "@fetch";
    export default async function() {
      return { result: await fetch({ test: "HELLO" }) }
    }
      `);
    deepStrictEqual(result, { result: { test: "HELLO" } });
  });
});

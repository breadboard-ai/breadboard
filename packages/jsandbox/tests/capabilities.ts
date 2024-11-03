/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import test, { describe } from "node:test";
import { loadRuntime, NodeSandbox } from "../src/node.js";
import { Module } from "../src/module.js";

async function run(
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const wasm = await loadRuntime();
  const module = new Module(
    new NodeSandbox(wasm),
    {
      fetch: async (_, inputs) => inputs,
      invoke: async (_, inputs) => inputs,
      secrets: async (_, inputs) => inputs,
    },
    { test: code }
  );
  const outputs = await module.invoke("test", inputs);
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

  test('can call secrets from "@secrets"', async () => {
    const result = await run(`import secrets from "@secrets";
    export default async function() {
      return { result: await secrets({ test: "HELLO" }) }
    }
      `);
    deepStrictEqual(result, { result: { test: "HELLO" } });
  });

  test('can call secrets from "@invoke"', async () => {
    const result = await run(`import invoke from "@invoke";
    export default async function() {
      return { result: await invoke({ test: "HELLO" }) }
    }
      `);
    deepStrictEqual(result, { result: { test: "HELLO" } });
  });
});

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { loadRuntime, NodeModuleManager } from "../src/node.js";
import { deepStrictEqual, ok, rejects } from "node:assert";
import { Capabilities } from "../src/capabilities.js";

async function run(
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  Capabilities.instance().install(1, {
    fetch: async (invocationId, inputs) => inputs,
  });

  const wasm = await loadRuntime();
  const manager = new NodeModuleManager(wasm);
  const outputs = await manager.invoke({ test: code }, "test", inputs);

  Capabilities.instance().uninstall(1);
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

  // test("can import breadboard:capabilities module", async () => {
  //   const result = await run(`import "breadboard:capabilities";
  //   export default function() {
  //     return { success: true }
  //   }`);
  //   ok(true);
  // });

  // test("can import fetch from breadboard:capabilities", async () => {
  //   const result = await run(`import { fetch } from "breadboard:capabilities";
  //   export default function() {
  //     return { fetch: typeof fetch }
  //   }
  //     `);
  //   deepStrictEqual(result, { fetch: "function" });
  // });

  // test("can call fetch from breadboard:capabilities", async () => {
  //   const result = await run(`import { fetch } from "breadboard:capabilities";
  //   export default async function() {
  //     return { result: await fetch(1, { test: "HELLO" }) }
  //   }
  //     `);
  //   deepStrictEqual(result, { result: { test: "HELLO" } });
  // });

  // test("gracefully handles unknown capability", async () => {
  //   await rejects(() =>
  //     run(`import { foo } from "breadboard:capabilities";
  //   export default async function() {
  //     return { result: await foo({ test: "HELLO" }) }
  //   }
  //     `)
  //   );
  // });
});

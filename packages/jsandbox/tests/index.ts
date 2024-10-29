/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { loadRuntime, RunModuleManager } from "../src/node.js";
import { deepStrictEqual, ok, rejects, throws } from "node:assert";
import { Capabilities } from "../src/capabilities.js";

Capabilities.instance().install([["fetch", async (inputs) => inputs]]);

async function run(
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const wasm = await loadRuntime();
  const manager = new RunModuleManager(wasm);
  return manager.runModule("default", "test", {}, code, inputs);
}

describe("runtime basics", () => {
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

  test("supports async export", async () => {
    deepStrictEqual(
      await run(
        `export default async function({test}) {
        return new Promise((resolve) => resolve({ result: test }));
      }`,
        { test: "HELLO" }
      ),
      { result: "HELLO" }
    );
  });
});

describe("runtime errors", () => {
  test("handles invalid module", async () => {
    await rejects(async () => run("export"), {
      name: "Error",
      message: /invalid export syntax/,
    });

    await rejects(async () => run("FOO"), {
      name: "Error",
      message: /Error converting from js 'undefined' into type 'function'/,
    });
  });

  test("handles errors thrown", async () => {
    await rejects(async () =>
      run(
        `export default function() {
        throw new Error("OH NOES");
      }`
      )
    );
  });
});

describe("can import capabilities", () => {
  test("can import breadboard:capabilities module", async () => {
    const result = await run(`import "breadboard:capabilities";
    export default function() {
      return { success: true }
    }`);
    ok(true);
  });

  test("can import fetch from breadboard:capabilities", async () => {
    const result = await run(`import { fetch } from "breadboard:capabilities";
    export default function() {
      return { fetch: typeof fetch }
    }
      `);
    deepStrictEqual(result, { fetch: "function" });
  });

  test("can call fetch from breadboard:capabilities", async () => {
    const result = await run(`import { fetch } from "breadboard:capabilities";
    export default async function() {
      return { result: await fetch({ test: "HELLO" }) }
    }
      `);
    deepStrictEqual(result, { result: { test: "HELLO" } });
  });

  test("gracefully handles unknown capability", async () => {
    rejects(() =>
      run(`import { foo } from "breadboard:capabilities";
    export default async function() {
      return { result: await foo({ test: "HELLO" }) }
    }
      `)
    );
  });
});

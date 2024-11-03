/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import { Console } from "node:console";
import test, { after, before, beforeEach, describe } from "node:test";
import { loadRuntime, NodeModuleManager } from "../src/node.js";

async function run(
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const uuid = crypto.randomUUID();
  const wasm = await loadRuntime();
  const manager = new NodeModuleManager(wasm);
  return manager.invoke(uuid, { test: code }, "test", inputs);
}

type Console = typeof globalThis.console;
type Message = {
  type: "log";
  args: any[];
};

let console: Console;
let messages: Message[] = [];

describe("console plugin", () => {
  before(() => {
    console = globalThis.console;
    globalThis.console = {
      log(...args) {
        messages.push({ type: "log", args });
      },
    } as Console;
  });
  beforeEach(() => {
    messages.length = 0;
  });
  test("does simple logging", async () => {
    deepStrictEqual(
      await run(`
export default function() {
  console.log("HELLO");
  return {}
}`),
      {}
    );
    deepStrictEqual(
      await run(`
export default function() {
  console.log(1);
  return {}
}`),
      {}
    );
    deepStrictEqual(
      await run(`
export default function() {
  console.log(1, "HELLO", false);
  return {}
}`),
      {}
    );
    deepStrictEqual(
      await run(`
export default function() {
  console.log(null, undefined);
  return {}
}`),
      {}
    );
    deepStrictEqual(messages, [
      { type: "log", args: ["HELLO"] },
      { type: "log", args: [1] },
      { type: "log", args: [1, "HELLO", false] },
      { type: "log", args: [null, "<Unrepresentable value>"] },
    ]);
  });

  after(() => {
    globalThis.console = console;
  });
});

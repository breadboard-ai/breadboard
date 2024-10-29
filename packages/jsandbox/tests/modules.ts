/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual, rejects } from "node:assert";
import test, { describe } from "node:test";
import { Capabilities } from "../src/capabilities.js";
import { loadRuntime, RunModuleManager } from "../src/node.js";

Capabilities.instance().install([["fetch", async (inputs) => inputs]]);

async function run(
  modules: Record<string, string>,
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const wasm = await loadRuntime();
  const manager = new RunModuleManager(wasm);
  return manager.runModule("default", "test", modules, code, inputs);
}

describe("peer module import", () => {
  test("can import a peer module", async () => {
    deepStrictEqual(
      await run(
        { foo: `export function foo() { return "HELLO"; }` },
        `import { foo } from "./foo";
        export default function() {
        return { result: foo() }
      }`
      ),
      { result: "HELLO" }
    );
  });

  test("can import default peer module import", async () => {
    deepStrictEqual(
      await run(
        { foo: `export default function() { return "HELLO"; }` },
        `import foo from "./foo";
        export default function() {
        return { result: foo() }
      }`
      ),
      { result: "HELLO" }
    );
  });

  test('can import peer modules with ".js" suffix', async () => {
    deepStrictEqual(
      await run(
        { foo: `export default function() { return "HELLO"; }` },
        `import foo from "./foo.js";
        export default function() {
        return { result: foo() }
      }`
      ),
      { result: "HELLO" }
    );
  });

  test("supports nested imports", async () => {
    deepStrictEqual(
      await run(
        {
          bar: `import foo from "./foo";
          export default function() {
            return \`HELLO \${foo()}\`;
          };`,
          foo: `export default function() { return "HELLO"; }`,
        },
        `import bar from "./bar";
        export default function() {
        return { result: bar() }
      }`
      ),
      { result: "HELLO HELLO" }
    );
  });

  test("can't import itself", async () => {
    await rejects(() =>
      run(
        { test: `export default function() { return "HELLO"; }` },
        `import foo from "./test";
      export default function() {
      return { result: foo() }
    }`
      )
    );

    await rejects(() =>
      run(
        {
          bar: `import foo from "./test";
          export default function() {
            return \`HELLO \${foo()}\`;
          };`,
          test: `export default function() { return "HELLO"; }`,
        },
        `import foo from "./bar";
      export default function() {
      return { result: foo() }
    }`
      )
    );
  });
});

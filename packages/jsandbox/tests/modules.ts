/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual, rejects } from "node:assert";
import test, { describe } from "node:test";
import { Capabilities } from "../src/capabilities.js";
import { loadRuntime, NodeModuleManager } from "../src/node.js";

async function run(
  modules: Record<string, string>,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const wasm = await loadRuntime();
  const manager = new NodeModuleManager(wasm);
  const outputs = await manager.invoke(modules, "test", inputs);
  return outputs;
}

describe("peer module import", () => {
  test("can import a peer module", async () => {
    deepStrictEqual(
      await run({
        foo: `export function foo() { return "HELLO"; }`,
        test: `import { foo } from "./foo";
        export default function() {
        return { result: foo() }
      }`,
      }),
      { result: "HELLO" }
    );
  });

  test("can import default peer module import", async () => {
    deepStrictEqual(
      await run({
        foo: `export default function() { return "HELLO"; }`,
        test: `import foo from "./foo";
        export default function() {
        return { result: foo() }
      }`,
      }),
      { result: "HELLO" }
    );
  });

  test('can import peer modules with ".js" suffix', async () => {
    deepStrictEqual(
      await run({
        foo: `export default function() { return "HELLO"; }`,
        test: `import foo from "./foo.js";
        export default function() {
        return { result: foo() }
      }`,
      }),
      { result: "HELLO" }
    );
  });

  test("supports nested imports", async () => {
    deepStrictEqual(
      await run({
        bar: `import foo from "./foo";
          export default function() {
            return \`HELLO \${foo()}\`;
          };`,
        foo: `export default function() { return "HELLO"; }`,
        test: `import bar from "./bar";
        export default function() {
        return { result: bar() }
      }`,
      }),
      { result: "HELLO HELLO" }
    );
  });

  test("can't import itself", async () => {
    await rejects(() =>
      run({
        test: `import foo from "./test";
      export default function() {
      return { result: foo() }
    }`,
      })
    );

    await rejects(() =>
      run({
        bar: `import foo from "./test";
          export default function() {
            return \`HELLO \${foo()}\`;
          };`,
        test: `import foo from "./bar";
      export default function() {
      return { result: foo() }
    }`,
      })
    );
  });
});

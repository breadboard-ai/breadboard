/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import test, { describe } from "node:test";
import { NodeSandbox } from "../src/node.js";
import { SandboxedModule } from "../src/module.js";

async function run(
  code: string,
  inputs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const module = new SandboxedModule(
    new NodeSandbox(),
    {
      fetch: async (inputs) => inputs,
      invoke: async (inputs) => inputs,
      secrets: async (inputs) => inputs,
    },
    { test: code }
  );
  const outputs = await module.invoke("test", inputs);
  return outputs;
}

describe("can use capabilities object argument", () => {
  test("function receives correct number of arguments", async () => {
    const result = await run(`
      export default function(inputs, capabilities) {
        return {
          argumentsLength: arguments.length,
          inputsType: typeof inputs,
          capabilitiesType: typeof capabilities
        }
      }`);
    deepStrictEqual(result, {
      argumentsLength: 2,
      inputsType: 'object',
      capabilitiesType: 'object'
    });
  });

  test("capabilities object contains all capability functions", async () => {
    const result = await run(`
      export default function(inputs, capabilities) {
        return {
          hasFetch: typeof capabilities?.fetch === "function",
          hasSecrets: typeof capabilities?.secrets === "function",
          hasInvoke: typeof capabilities?.invoke === "function",
          hasInput: typeof capabilities?.input === "function",
          hasOutput: typeof capabilities?.output === "function",
          hasDescribe: typeof capabilities?.describe === "function",
          hasQuery: typeof capabilities?.query === "function",
          hasRead: typeof capabilities?.read === "function",
          hasWrite: typeof capabilities?.write === "function",
          hasBlob: typeof capabilities?.blob === "function"
        }
      }`);
    deepStrictEqual(result, {
      hasFetch: true,
      hasSecrets: true,
      hasInvoke: true,
      hasInput: true,
      hasOutput: true,
      hasDescribe: true,
      hasQuery: true,
      hasRead: true,
      hasWrite: true,
      hasBlob: true
    });
  });

  test("can call capabilities via capabilities object", async () => {
    const result = await run(`
      export default async function(inputs, capabilities) {
        return {
          fetchResult: await capabilities?.fetch({ test: "FETCH" }),
          secretsResult: await capabilities?.secrets({ test: "SECRETS" }),
          invokeResult: await capabilities?.invoke({ test: "INVOKE" })
        }
      }`);
    deepStrictEqual(result, {
      fetchResult: { test: "FETCH" },
      secretsResult: { test: "SECRETS" },
      invokeResult: { test: "INVOKE" }
    });
  });
});

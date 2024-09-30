/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { run } from "@google-labs/breadboard/harness";
import { asRuntimeKit } from "@google-labs/breadboard";
import Core, { core, coreKit } from "@google-labs/core-kit";
import resolve from "../src/nodes/resolve.js";
import { board, input, serialize } from "@breadboard-ai/build";

test("resolve resolves paths relative to the board base by default", async (t) => {
  t.deepEqual(
    await resolve.invoke(
      { path: "./bar.json" },
      { base: new URL("http://example.com/graphs/foo.json") }
    ),
    { path: "http://example.com/graphs/bar.json" }
  );
});

test("resolve resolves paths relative to the $base input when provided", async (t) => {
  t.deepEqual(
    await resolve.invoke(
      {
        path: "./bar.json",
        $base: "file://not/the/default/foo.json",
      },
      { base: new URL("http://example.com/graphs/foo.json") }
    ),
    { path: "file://not/the/default/bar.json" }
  );
});

test("resolve resolves multiple input properties", async (t) => {
  t.deepEqual(
    await resolve.invoke(
      {
        bar: "./bar.json",
        abc123: "./abc123.json",
      },
      { base: new URL("http://example.com/graphs/foo.json") }
    ),
    {
      bar: "http://example.com/graphs/bar.json",
      abc123: "http://example.com/graphs/abc123.json",
    }
  );
});

test("resolve does nothing with no inputs", async (t) => {
  t.deepEqual(
    await resolve.invoke(
      {},
      { base: new URL("http://example.com/graphs/foo.json") }
    ),
    {}
  );
});

test("resolve can be used to fully qualify a path prior to passing to a graph with a different base", async (t) => {
  const config = {
    url: "../../tests/data/resolve/main.json",
    base: new URL(import.meta.url),
    kits: [asRuntimeKit(Core)],
  };
  let output: string | undefined;
  for await (const result of run(config)) {
    if (result.type === "error") {
      console.error(result.data.error);
      t.fail(JSON.stringify(result.data.error, null, 2));
    } else if (result.type == "input" && result.data.node.id === "main-input") {
      result.reply({
        inputs: { "next-path": "../../tests/data/resolve/invokee.json" },
      });
    } else if (
      result.type === "output" &&
      result.data.node.id === "main-output"
    ) {
      output = result.data.outputs.result?.toString();
    }
  }
  t.is(output, "invokee-data");
});

test("resolve generates expected BGL", async (t) => {
  const path = input();
  const resolver = coreKit.resolve({ path });
  const b = board({
    inputs: { path },
    outputs: { resolved: resolver.unsafeOutput("resolved") },
  });
  const serialized = serialize(b);
  t.deepEqual(serialized, {
    edges: [
      {
        from: "input-0",
        in: "path",
        out: "path",
        to: "resolve-0",
      },
      {
        from: "resolve-0",
        in: "resolved",
        out: "resolved",
        to: "output-0",
      },
    ],
    nodes: [
      {
        id: "input-0",
        type: "input",
        configuration: {
          schema: {
            properties: {
              path: {
                type: "string",
              },
            },
            required: ["path"],
            type: "object",
          },
        },
      },
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              resolved: {
                type: [
                  "array",
                  "boolean",
                  "null",
                  "number",
                  "object",
                  "string",
                ],
              },
            },
            required: ["resolved"],
          },
        },
      },
      {
        id: "resolve-0",
        type: "resolve",
        configuration: {},
      },
    ],
  });
});

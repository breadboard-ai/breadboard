/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { run } from "@google-labs/breadboard/harness";
import { board, asRuntimeKit } from "@google-labs/breadboard";
import Core, { core } from "@google-labs/core-kit";
import resolve from "../src/nodes/resolve.js";

test("resolve resolves paths relative to the board base by default", async (t) => {
  t.deepEqual(
    await resolve(
      { path: "./bar.json" },
      { base: new URL("http://example.com/graphs/foo.json") }
    ),
    { path: "http://example.com/graphs/bar.json" }
  );
});

test("resolve resolves paths relative to the $base input when provided", async (t) => {
  t.deepEqual(
    await resolve(
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
    await resolve(
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
    await resolve({}, { base: new URL("http://example.com/graphs/foo.json") }),
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
  const serialized = await board(({ path }) => {
    const resolve = core.resolve();
    path.to(resolve);
    return { resolved: resolve.resolved };
  }).serialize();
  t.deepEqual(serialized, {
    edges: [
      {
        from: "resolve-3",
        in: "resolved",
        out: "resolved",
        to: "output-2",
      },
      {
        from: "input-1",
        in: "path",
        out: "path",
        to: "resolve-3",
      },
    ],
    graphs: {},
    nodes: [
      {
        configuration: {
          schema: {
            properties: {
              resolved: {
                title: "resolved",
                type: "string",
              },
            },
            type: "object",
          },
        },
        id: "output-2",
        type: "output",
      },
      {
        configuration: {},
        id: "resolve-3",
        type: "resolve",
      },
      {
        configuration: {
          schema: {
            properties: {
              path: {
                title: "path",
                type: "string",
              },
            },
            required: ["path"],
            type: "object",
          },
        },
        id: "input-1",
        type: "input",
      },
    ],
  });
});

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { getGraphHandler } from "../../../src/handler.js";
import { deepStrictEqual, ok } from "node:assert";
import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import { NodeDescriberResult, NodeDescriberWires } from "../../../src/types.js";

describe("getGraphHandler", () => {
  test("returns undefined for non-URL-like type", async () => {
    const handler = await getGraphHandler("awesome-node-type", {});
    ok(handler === undefined);
  });

  test("returns handler for URL-like type", async () => {
    const handler = await getGraphHandler("https://example.com/1", {
      loader: {
        async load(url: string) {
          ok(url === "https://example.com/1");
          return {
            nodes: {},
            edges: {},
          } as GraphDescriptor;
        },
      },
    });
    ok(handler !== undefined);
    ok("invoke" in handler);
  });

  test("returns handler that can be invoked for URL-like type", async () => {
    const handler = await getGraphHandler("https://example.com/2", {
      loader: {
        async load(url: string) {
          ok(url === "https://example.com/2");
          return simple as GraphDescriptor;
        },
      },
    });
    ok(handler !== undefined);
    ok("invoke" in handler);
    const result = await handler.invoke({ text: "hello" }, {});
    ok(result !== undefined);
    deepStrictEqual(result, { text: "hello" });
  });

  test("returns handler with a describer for URL-like type", async () => {
    const handler = await getGraphHandler("https://example.com/3", {
      loader: {
        async load(url: string) {
          ok(url === "https://example.com/3");
          return simple as GraphDescriptor;
        },
      },
    });
    ok(handler !== undefined);
    ok("describe" in handler);
    const description = await handler.describe?.(
      {},
      {},
      {},
      {
        kits: [],
        outerGraph: simple,
        wires: {} as NodeDescriberWires,
      }
    );
    ok(description !== undefined);
    deepStrictEqual(description, {
      inputSchema: {
        additionalProperties: false,
        properties: {
          text: { type: "string", examples: [], title: "Text" },
        },
        required: [],
        type: "object",
      },
      outputSchema: {
        additionalProperties: false,
        properties: {
          text: { type: "string", examples: [], title: "Text" },
        },
        required: [],
        type: "object",
      },
    } as NodeDescriberResult);
  });
});

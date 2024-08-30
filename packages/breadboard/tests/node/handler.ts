/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { getGraphHandler } from "../../src/handler.js";
import { deepStrictEqual, ok } from "node:assert";
import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import simple from "../bgl/simple.bgl.json" with { type: "json" };

describe("getGraphHandler", () => {
  test("returns undefined for non-URL-like type", async () => {
    const handler = await getGraphHandler(
      "awesome-node-type",
      new URL("https://example.com"),
      {}
    );
    ok(handler === undefined);
  });

  test("returns handler for URL-like type", async () => {
    const handler = await getGraphHandler(
      "https://example.com",
      new URL("https://example.com"),
      {
        loader: {
          async load(url: string) {
            ok(url === "https://example.com");
            return {
              nodes: {},
              edges: {},
            } as GraphDescriptor;
          },
        },
      }
    );
    ok(handler !== undefined);
    ok("invoke" in handler);
  });

  test("returns handler that can be invoked for URL-like type", async () => {
    const handler = await getGraphHandler(
      "https://example.com",
      new URL("https://example.com"),
      {
        loader: {
          async load(url: string) {
            ok(url === "https://example.com");
            return simple as GraphDescriptor;
          },
        },
      }
    );
    ok(handler !== undefined);
    ok("invoke" in handler);
    const result = await handler.invoke({ text: "hello" }, {});
    ok(result !== undefined);
    deepStrictEqual(result, { text: "hello" });
  });
});

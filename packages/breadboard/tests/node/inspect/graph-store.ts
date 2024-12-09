/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual } from "node:assert";
import { describe, it } from "node:test";
import { makeTestGraphStore } from "../../helpers/_graph-store.js";
import { testKit } from "../test-kit.js";

describe("GraphStore.graphs", () => {
  it("correctly lists legacy kits as graphs", () => {
    const graphStore = makeTestGraphStore({
      kits: [testKit],
    });
    deepStrictEqual(graphStore.graphs(), [
      { mainGraph: { title: "Test Kit" }, url: "invoke" },
      {
        mainGraph: { title: "Test Kit" },
        url: "map",
        title: "Map",
        tags: ["experimental"],
      },
      { mainGraph: { title: "Test Kit" }, url: "promptTemplate" },
      { url: "runJavascript", mainGraph: { title: "Test Kit" } },
      { url: "secrets", mainGraph: { title: "Test Kit" } },
    ]);
  });

  it("correctly lists added graphs", () => {
    const graphStore = makeTestGraphStore({
      kits: [testKit],
    });
    graphStore.addByDescriptor({
      url: "https://example.com/foo",
      title: "Foo",
      nodes: [],
      edges: [],
    });
    deepStrictEqual(graphStore.graphs(), [
      { mainGraph: { title: "Test Kit" }, url: "invoke" },
      {
        mainGraph: { title: "Test Kit" },
        url: "map",
        title: "Map",
        tags: ["experimental"],
      },
      { mainGraph: { title: "Test Kit" }, url: "promptTemplate" },
      { url: "runJavascript", mainGraph: { title: "Test Kit" } },
      { url: "secrets", mainGraph: { title: "Test Kit" } },
      {
        title: "Foo",
        url: "https://example.com/foo",
        mainGraph: { title: "Foo", url: "https://example.com/foo" },
      },
    ]);
  });
});

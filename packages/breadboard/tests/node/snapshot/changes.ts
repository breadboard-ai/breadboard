/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { Snapshot } from "../../../src/inspector/snapshot/snapshot.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import { MutableGraphImpl } from "../../../src/inspector/graph/mutable-graph.js";
import { makeTestGraphStore } from "../../helpers/_graph-store.js";
import { deepStrictEqual } from "node:assert";
import {
  SnapshotChangeSpec,
  SnapshotPendingUpdate,
  SnapshotUpdatePortsSpec,
} from "../../../src/inspector/snapshot/types.js";

function mutable(graph: GraphDescriptor) {
  return new MutableGraphImpl(
    graph,
    makeTestGraphStore({
      kits: [
        {
          url: "",
          handlers: {
            type: {
              invoke: () => {
                throw new Error('Test error: "type" should not be invoked');
              },
            },
            runModule: {
              invoke: () => {
                throw new Error(
                  'Test error: "run-module" should not be invoked'
                );
              },
            },
          },
        },
      ],
    })
  );
}

function timeless(spec: SnapshotChangeSpec[]): Partial<SnapshotChangeSpec>[] {
  const result = structuredClone(spec);
  result.forEach((r) => {
    delete (r as Partial<SnapshotChangeSpec>).timestamp;
  });
  return result;
}

type Timeless<T> = T extends { timestamp: number } ? Omit<T, "timestamp"> : T;

describe("Snapshot changes", async () => {
  it("correctly builds initial list of changes", () => {
    const blank = new Snapshot(mutable({ nodes: [], edges: [] }));
    blank.start();
    deepStrictEqual(timeless(blank.changes), [
      {
        type: "addgraph",
        graphId: "",
      },
    ] satisfies Timeless<SnapshotChangeSpec>[]);

    const withInlineMetadata = new Snapshot(
      mutable({ title: "Foo", description: "Bar", nodes: [], edges: [] })
    );
    withInlineMetadata.start();
    deepStrictEqual(timeless(withInlineMetadata.changes), [
      {
        type: "addgraph",
        metadata: { title: "Foo", description: "Bar" },
        graphId: "",
      },
    ] satisfies Timeless<SnapshotChangeSpec>[]);

    const withMetadata = new Snapshot(
      mutable({
        version: "0.0.1",
        nodes: [],
        edges: [],
        metadata: { tags: ["published"] },
      })
    );
    withMetadata.start();
    deepStrictEqual(timeless(withMetadata.changes), [
      {
        type: "addgraph",
        metadata: { version: "0.0.1" },
        graphId: "",
      },
      {
        type: "changegraphmetadata",
        graphId: "",
        metadata: { tags: ["published"] },
      },
    ] satisfies Timeless<SnapshotChangeSpec>[]);

    const everything = new Snapshot(
      mutable({
        title: "Title",
        nodes: [
          { id: "first", type: "type", configuration: { foo: "foo" } },
          { id: "second", type: "type", configuration: { bar: "bar" } },
        ],
        edges: [{ from: "first", out: "out", to: "second", in: "in" }],
        modules: {
          mod1: {
            code: "foo",
          },
          mod2: {
            code: "bar",
            metadata: {
              runnable: true,
            },
          },
        },
        graphs: {
          subgraph1: {
            title: "Subgraph 1",
            nodes: [
              { id: "third", type: "type", configuration: { foo: "baz" } },
            ],
            edges: [{ from: "third", out: "out", to: "third", in: "in" }],
          },
        },
      })
    );
    everything.start();
    deepStrictEqual(timeless(everything.changes), [
      {
        type: "addgraph",
        metadata: { title: "Title" },
        graphId: "",
      },
      {
        type: "addnode",
        node: { id: "first", type: "type", configuration: { foo: "foo" } },
        graphId: "",
      },
      {
        type: "addnode",
        node: { id: "second", type: "type", configuration: { bar: "bar" } },
        graphId: "",
      },
      {
        type: "addedge",
        edge: { from: "first", out: "out", to: "second", in: "in" },
        id: 1115284803,
        graphId: "",
      },
      {
        type: "addmodule",
        id: "mod1",
        module: {
          code: "foo",
        },
      },
      {
        type: "addmodule",
        id: "mod2",
        module: {
          code: "bar",
          metadata: {
            runnable: true,
          },
        },
      },
      {
        graphId: "subgraph1",
        metadata: {
          title: "Subgraph 1",
        },
        type: "addgraph",
      },
      {
        graphId: "subgraph1",
        node: {
          configuration: {
            foo: "baz",
          },
          id: "third",
          type: "type",
        },
        type: "addnode",
      },
      {
        edge: {
          from: "third",
          in: "in",
          out: "out",
          to: "third",
        },
        graphId: "subgraph1",
        id: 4075679067,
        type: "addedge",
      },
    ] satisfies Timeless<SnapshotChangeSpec>[]);
    // The "first" item has already been consumed by update by now.
    deepStrictEqual(everything.pending, [
      {
        type: "updateports",
        graphId: "",
        nodeId: "second",
      },
      {
        type: "updateports",
        graphId: "subgraph1",
        nodeId: "third",
      },
    ] satisfies SnapshotPendingUpdate[]);

    const imperative = new Snapshot(
      mutable({
        title: "Title",
        main: "main",
        modules: {
          main: {
            code: "code",
          },
        },
        edges: [],
        nodes: [],
      })
    );
    imperative.start();
    deepStrictEqual(timeless(imperative.changes), [
      {
        type: "addgraph",
        metadata: { title: "Title" },
        main: "main",
        graphId: "",
      },
      {
        type: "addmodule",
        id: "main",
        module: {
          code: "code",
        },
      },
    ] satisfies Timeless<SnapshotChangeSpec>[]);
  });

  await it("correctly produces initial port updates", async () => {
    const oneNode = new Snapshot(
      mutable({
        title: "Title",
        nodes: [{ id: "first", type: "type", configuration: { foo: "foo" } }],
        edges: [],
      })
    );
    const events: string[] = [];
    oneNode.addEventListener("fresh", () => {
      events.push("fresh");
    });
    oneNode.addEventListener("stale", () => {
      events.push("stale");
    });
    oneNode.start();

    deepStrictEqual(timeless(oneNode.changes), [
      {
        type: "addgraph",
        metadata: { title: "Title" },
        graphId: "",
      },
      {
        type: "addnode",
        node: { id: "first", type: "type", configuration: { foo: "foo" } },
        graphId: "",
      },
    ] satisfies Timeless<SnapshotChangeSpec>[]);
    deepStrictEqual(oneNode.pending, []);

    await oneNode.fresh;
    deepStrictEqual(events, ["stale", "fresh"]);
    deepStrictEqual(oneNode.changes.length, 3);
    const types = oneNode.changes.map((change) => change.type);
    deepStrictEqual(types, ["addgraph", "addnode", "updateports"]);
    const updateports = oneNode.changes.at(2) as SnapshotUpdatePortsSpec;
    deepStrictEqual(updateports.input.added.length, 3);
    deepStrictEqual(updateports.input.deleted.length, 0);
    deepStrictEqual(updateports.input.updated.length, 0);
    deepStrictEqual(updateports.output.added.length, 3);
    deepStrictEqual(updateports.output.deleted.length, 0);
    deepStrictEqual(updateports.output.updated.length, 0);
    deepStrictEqual(updateports.side.added.length, 0);
    deepStrictEqual(updateports.side.deleted.length, 0);
    deepStrictEqual(updateports.side.updated.length, 0);
  });
});

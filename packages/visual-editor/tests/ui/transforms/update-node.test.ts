/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { UpdateNode } from "../../../src/ui/transforms/update-node.js";
import type {
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  NodeConfiguration,
  NodeMetadata,
} from "@breadboard-ai/types";
import type { TemplatePart } from "@breadboard-ai/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function chip(part: TemplatePart): string {
  return `{${JSON.stringify(part)}}`;
}

function configWith(text: string): NodeConfiguration {
  return {
    config$prompt: { role: "user", parts: [{ text }] },
  };
}

function createMockContext(opts: {
  nodes?: {
    id: string;
    type?: string;
    metadata?: NodeMetadata;
    configuration?: NodeConfiguration;
  }[];
  graphId?: string;
  graphMetadata?: Record<string, unknown>;
}) {
  const appliedEdits: EditSpec[][] = [];
  const graphId = opts.graphId ?? "main";
  const nodes = opts.nodes ?? [];

  const nodeConfigs = new Map(nodes.map((n) => [n.id, n.configuration ?? {}]));

  const makeNodeObj = (n: (typeof nodes)[0]) => ({
    descriptor: {
      id: n.id,
      type: n.type ?? "test-type",
      metadata: n.metadata ?? {},
      configuration: n.configuration ?? {},
    },
    configuration: () => nodeConfigs.get(n.id)!,
    metadata: () => n.metadata ?? {},
    routes: () => [],
    currentPorts: () => ({
      inputs: { ports: [] },
      outputs: { ports: [] },
    }),
    ports: async () => ({
      inputs: { ports: [] },
      outputs: { ports: [] },
    }),
    incoming: () => [],
    outgoing: () => [],
    title: () => n.metadata?.title ?? n.id,
  });

  const inspectable = {
    nodeById: (id: string) => {
      const n = nodes.find((n) => n.id === id);
      return n ? makeNodeObj(n) : null;
    },
    nodes: () => nodes.map(makeNodeObj),
    metadata: () => opts.graphMetadata ?? {},
    raw: () => ({ nodes: [], edges: [] }),
  };

  const graphs = new Map([[graphId, inspectable]]);

  const context = {
    graph: { nodes: [], edges: [] },
    mutable: { graphs },
    apply: mock.fn(async (edits: EditSpec[]): Promise<EditTransformResult> => {
      appliedEdits.push(edits);
      return { success: true };
    }),
  } as unknown as EditOperationContext;

  return { context, appliedEdits };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("UpdateNode", () => {
  it("fails if graph is not found", async () => {
    const { context } = createMockContext({ graphId: "other" });

    const transform = new UpdateNode("node-1", "missing", null, null, null);
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing"));
    }
  });

  it("fails if node is not found", async () => {
    const { context } = createMockContext({
      nodes: [{ id: "node-1" }],
    });

    const transform = new UpdateNode("missing-node", "main", null, null, null);
    const result = await transform.apply(context);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.includes("missing-node"));
    }
  });

  it("updates configuration", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", configuration: { old: "value" } }],
    });

    const transform = new UpdateNode(
      "node-1",
      "main",
      { new: "value" },
      null,
      null
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits[0].filter(
      (e) => e.type === "changeconfiguration"
    );
    assert.equal(configEdits.length, 1);
    if (configEdits[0].type === "changeconfiguration") {
      assert.equal(configEdits[0].configuration.new, "value");
      assert.equal(configEdits[0].configuration.old, "value");
    }
  });

  it("deletes null/undefined configuration keys", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", configuration: { keep: "yes", remove: "no" } }],
    });

    const transform = new UpdateNode(
      "node-1",
      "main",
      { remove: null },
      null,
      null
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const configEdits = appliedEdits[0].filter(
      (e) => e.type === "changeconfiguration"
    );
    if (configEdits[0].type === "changeconfiguration") {
      assert.equal(configEdits[0].configuration.keep, "yes");
      assert.equal(configEdits[0].configuration.remove, undefined);
    }
  });

  it("updates metadata", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", metadata: { title: "Old" } }],
    });

    const transform = new UpdateNode(
      "node-1",
      "main",
      null,
      { title: "New" },
      null
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const metaEdits = appliedEdits[0].filter(
      (e) => e.type === "changemetadata"
    );
    assert.equal(metaEdits.length, 1);
  });

  it("sets titleUserModified when title changes", async () => {
    const { context } = createMockContext({
      nodes: [{ id: "node-1", metadata: { title: "Old" } }],
    });

    const transform = new UpdateNode(
      "node-1",
      "main",
      null,
      { title: "New" },
      null
    );
    await transform.apply(context);

    assert.equal(transform.titleUserModified, true);
  });

  it("calls UpdateNodeTitle when title changes", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        { id: "node-1", metadata: { title: "Old" } },
        {
          id: "node-2",
          configuration: configWith(
            `${chip({ type: "in", path: "node-1", title: "Old" })}`
          ),
        },
      ],
    });

    const transform = new UpdateNode(
      "node-1",
      "main",
      null,
      { title: "New Title" },
      null
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have multiple apply calls — including config updates from UpdateNodeTitle
    assert.ok(appliedEdits.length >= 2);
  });

  it("updates configuration and metadata together", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1", configuration: { prompt: "old" }, metadata: {} }],
    });

    const transform = new UpdateNode(
      "node-1",
      "main",
      { prompt: "new" },
      { title: "Updated" },
      null
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const edits = appliedEdits[0];
    const configEdits = edits.filter((e) => e.type === "changeconfiguration");
    const metaEdits = edits.filter((e) => e.type === "changemetadata");
    assert.equal(configEdits.length, 1);
    assert.equal(metaEdits.length, 1);
  });

  it("autowires ports when provided", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "node-1" }, { id: "source" }],
    });

    const transform = new UpdateNode("node-1", "main", null, null, [
      { path: "source", title: "@source" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // AutoWireInPorts should have been called
    assert.ok(appliedEdits.length >= 2);
  });

  it("triggers ChangeEdgesToBroadcastMode on routing → broadcast transition", async () => {
    // Node has existing routes, but new config has no route chips
    const routeChip = `{${JSON.stringify({
      type: "tool",
      path: "control-flow/routing",
      instance: "target-1",
      title: "Route",
    })}}`;

    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          type: "test-type",
          configuration: configWith(`Route ${routeChip}`),
        },
      ],
    });

    // Mock routes() to return existing routes
    const inspectable = context.mutable.graphs.get("main")!;
    const origNodeById = inspectable.nodeById;
    (inspectable as Record<string, unknown>).nodeById = (id: string) => {
      const node = (origNodeById as (id: string) => unknown)(id) as Record<
        string,
        unknown
      > | null;
      if (node && id === "node-1") {
        return {
          ...node,
          routes: () => [
            { path: "control-flow/routing", instance: "target-1" },
          ],
        };
      }
      return node;
    };

    // New config has NO route chips — triggers routing → broadcast
    const transform = new UpdateNode(
      "node-1",
      "main",
      { prompt: "Just text, no routes" },
      null,
      null
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have config change + broadcast mode transform call
    assert.ok(appliedEdits.length >= 2);
  });

  it("triggers ChangeEdgesToRoutingMode on broadcast → routing transition", async () => {
    // Node has no existing routes, but new config has route chips
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "node-1",
          type: "test-type",
          configuration: configWith("no routes yet"),
        },
      ],
    });

    // Route chip in the configuration
    const routeChip = `{${JSON.stringify({
      type: "tool",
      path: "control-flow/routing",
      instance: "target-1",
      title: "Route",
    })}}`;

    const transform = new UpdateNode(
      "node-1",
      "main",
      configWith(`Route ${routeChip}`),
      null,
      null
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have config change + routing mode transform call
    assert.ok(appliedEdits.length >= 2);
  });
});

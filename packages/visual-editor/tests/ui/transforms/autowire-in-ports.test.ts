/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { AutoWireInPorts } from "../../../src/ui/transforms/autowire-in-ports.js";
import type {
  Edge,
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  InspectableNode,
  NodeConfiguration,
  PortStatus,
} from "@breadboard-ai/types";
import type { TemplatePart } from "@breadboard-ai/utils";

// ── Helpers ────────────────────────────────────────────────────────────────

function chip(part: TemplatePart): string {
  return `{${JSON.stringify(part)}}`;
}

const inChip = (path: string): TemplatePart => ({
  type: "in",
  path,
  title: `@${path}`,
});

function configWith(text: string): NodeConfiguration {
  return {
    config$prompt: { role: "user", parts: [{ text }] },
  };
}

type MockNodeOpts = {
  id: string;
  configuration?: NodeConfiguration;
  routes?: string[];
  mainOutputPort?: string;
  regularOutputPorts?: string[];
  connectedPzEdges?: Edge[];
};

function makeNode(opts: MockNodeOpts) {
  const connectedStatus = "connected" as PortStatus; // PortStatus.Connected

  return {
    descriptor: { id: opts.id },
    configuration: () => opts.configuration ?? {},
    routes: () => (opts.routes ?? []).map((r) => ({ path: r })),
    currentPorts: () => ({
      inputs: {
        ports: (opts.connectedPzEdges ?? []).map((edge) => ({
          name: edge.in,
          star: false,
          status: connectedStatus,
          edges: [{ raw: () => edge }],
          schema: {},
        })),
      },
      outputs: {
        ports: [
          ...(opts.mainOutputPort
            ? [
                {
                  name: opts.mainOutputPort,
                  star: false,
                  schema: { behavior: ["main-port"] },
                },
              ]
            : []),
          ...(opts.regularOutputPorts ?? []).map((name) => ({
            name,
            star: false,
            schema: {},
          })),
        ],
      },
    }),
    ports: async () => ({
      inputs: { ports: [] },
      outputs: { ports: [] },
    }),
    incoming: () => [],
    outgoing: () => [],
  } as unknown as InspectableNode;
}

function createMockContext(opts: {
  nodes: MockNodeOpts[];
  graphId?: string;
  edges?: Edge[];
}) {
  const appliedEdits: EditSpec[][] = [];
  const graphId = opts.graphId ?? "main";
  const nodeMap = new Map(opts.nodes.map((n) => [n.id, makeNode(n)]));

  const inspectable = {
    nodeById: (id: string) => nodeMap.get(id) ?? null,
    nodes: () => Array.from(nodeMap.values()),
    raw: () => ({
      nodes: opts.nodes.map((n) => ({
        id: n.id,
        type: "test-type",
      })),
      edges: opts.edges ?? [],
    }),
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

describe("AutoWireInPorts", () => {
  it("fails if graph is not found", async () => {
    const { context } = createMockContext({
      nodes: [],
      graphId: "other",
    });

    const transform = new AutoWireInPorts("node-1", "missing", []);
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("fails if node is not found", async () => {
    const { context } = createMockContext({
      nodes: [{ id: "a" }],
    });

    const transform = new AutoWireInPorts("missing", "main", []);
    const result = await transform.apply(context);

    assert.equal(result.success, false);
  });

  it("creates edges from in-ports with main-port output", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "source",
          mainOutputPort: "content",
        },
        { id: "target" },
      ],
    });

    const transform = new AutoWireInPorts("target", "main", [
      { path: "source", title: "@source" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 1);
    if (addEdges[0].type === "addedge") {
      assert.equal(addEdges[0].edge.from, "source");
      assert.equal(addEdges[0].edge.to, "target");
      assert.equal(addEdges[0].edge.out, "content");
      assert.equal(addEdges[0].edge.in, "p-z-source");
    }
  });

  it("uses receiver id as out port when source has routes (routing mode)", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "router",
          routes: ["some-route"],
        },
        { id: "target" },
      ],
    });

    const transform = new AutoWireInPorts("target", "main", [
      { path: "router", title: "@router" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 1);
    if (addEdges[0].type === "addedge") {
      // In routing mode, out port is the receiver node id
      assert.equal(addEdges[0].edge.out, "target");
    }
  });

  it("uses first regular output port when source has no main-port", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "source",
          regularOutputPorts: ["output"],
        },
        { id: "target" },
      ],
    });

    const transform = new AutoWireInPorts("target", "main", [
      { path: "source", title: "@source" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 1);
    if (addEdges[0].type === "addedge") {
      assert.equal(addEdges[0].edge.out, "output");
    }
  });

  it("marks references invalid when source node is not found", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "target",
          configuration: configWith(`Use ${chip(inChip("missing-source"))}`),
        },
      ],
    });

    const transform = new AutoWireInPorts("target", "main", [
      { path: "missing-source", title: "@missing" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should have a changeconfiguration to mark the ref as invalid
    const configEdits = appliedEdits
      .flat()
      .filter((e) => e.type === "changeconfiguration");
    assert.ok(
      configEdits.length >= 1,
      "should mark invalid reference in config"
    );
  });

  it("removes deleted edges when not in updateOnly mode", async () => {
    const existingEdge: Edge = {
      from: "old-source",
      to: "target",
      out: "content",
      in: "p-z-old-source",
    };

    const { context, appliedEdits } = createMockContext({
      nodes: [
        { id: "old-source", mainOutputPort: "content" },
        { id: "new-source", mainOutputPort: "content" },
        {
          id: "target",
          connectedPzEdges: [existingEdge],
        },
      ],
    });

    // Only new-source — old-source should be deleted
    const transform = new AutoWireInPorts("target", "main", [
      { path: "new-source", title: "@new" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const removeEdges = appliedEdits
      .flat()
      .filter((e) => e.type === "removeedge");
    assert.equal(removeEdges.length, 1, "should remove old edge");
    const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 1, "should add new edge");
  });

  it("skips deletions in updateOnly mode", async () => {
    const existingEdge: Edge = {
      from: "old-source",
      to: "target",
      out: "content",
      in: "p-z-old-source",
    };

    const { context, appliedEdits } = createMockContext({
      nodes: [
        { id: "old-source", mainOutputPort: "content" },
        { id: "new-source", mainOutputPort: "content" },
        {
          id: "target",
          connectedPzEdges: [existingEdge],
        },
      ],
    });

    // updateOnly = true — should NOT remove old edges
    const transform = new AutoWireInPorts(
      "target",
      "main",
      [{ path: "new-source", title: "@new" }],
      true
    );
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    const removeEdges = appliedEdits
      .flat()
      .filter((e) => e.type === "removeedge");
    assert.equal(removeEdges.length, 0, "should NOT remove old edges");
    const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 1, "should add new edge");
  });

  it("marks references invalid when adding creates a cycle", async () => {
    // Create a cycle: target -> source already exists, source -> target would create cycle
    const { context, appliedEdits } = createMockContext({
      nodes: [
        { id: "source", mainOutputPort: "content" },
        {
          id: "target",
          configuration: configWith(`Use ${chip(inChip("source"))}`),
        },
      ],
      edges: [{ from: "target", to: "source", out: "output", in: "input" }],
    });

    const transform = new AutoWireInPorts("target", "main", [
      { path: "source", title: "@source" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // The edge should NOT be added (cycle), and the ref should be marked invalid
    const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
    assert.equal(addEdges.length, 0, "should not add cyclic edge");
    const configEdits = appliedEdits
      .flat()
      .filter((e) => e.type === "changeconfiguration");
    assert.ok(configEdits.length >= 1, "should mark ref as invalid");
  });

  it("handles empty ports list", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [{ id: "target" }],
    });

    const transform = new AutoWireInPorts("target", "main", []);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should still call apply but with empty edits
    assert.equal(appliedEdits.length, 1);
    assert.equal(appliedEdits[0].length, 0);
  });

  it("skips ports with $ prefix and star ports", async () => {
    const { context, appliedEdits } = createMockContext({
      nodes: [
        {
          id: "source",
          // Only has $-prefixed output ports
          regularOutputPorts: ["$error"],
        },
        {
          id: "target",
          configuration: configWith(`Use ${chip(inChip("source"))}`),
        },
      ],
    });

    const transform = new AutoWireInPorts("target", "main", [
      { path: "source", title: "@source" },
    ]);
    const result = await transform.apply(context);

    assert.equal(result.success, true);
    // Should mark reference invalid since no valid output port is found
    const configEdits = appliedEdits
      .flat()
      .filter((e) => e.type === "changeconfiguration");
    assert.ok(configEdits.length >= 1, "should mark invalid for $-port source");
  });
});

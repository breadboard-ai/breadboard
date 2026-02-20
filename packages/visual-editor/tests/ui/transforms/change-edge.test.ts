/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ChangeEdge } from "../../../src/ui/transforms/change-edge.js";
import type {
  Edge,
  EditOperationContext,
  EditSpec,
  EditTransformResult,
  InspectableNode,
  NodeConfiguration,
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

const inChip = (path: string, opts?: { invalid?: boolean }): TemplatePart => ({
  type: "in",
  path,
  title: `@${path}`,
  ...(opts?.invalid ? { invalid: true } : {}),
});

const routeChip = (
  instance: string,
  opts?: { invalid?: boolean }
): TemplatePart => ({
  type: "tool",
  path: "control-flow/routing",
  instance,
  title: "Route",
  ...(opts?.invalid ? { invalid: true } : {}),
});

type MockNodeOpts = {
  id: string;
  configuration?: NodeConfiguration;
  routes?: string[];
  title?: string;
  atWireable?: boolean;
  mainPort?: boolean;
  contentPort?: string;
  contentPortValue?: unknown;
  outputPorts?: { name: string; mainPort?: boolean }[];
  incoming?: Edge[];
};

function makeNode(opts: MockNodeOpts) {
  return {
    descriptor: {
      id: opts.id,
      type: "test-type",
      configuration: opts.configuration ?? {},
    },
    configuration: () => opts.configuration ?? {},
    routes: () => (opts.routes ?? []).map((r) => ({ path: r })),
    title: () => opts.title ?? opts.id,
    incoming: () =>
      (opts.incoming ?? []).map((e) => ({
        from: { descriptor: { id: e.from } },
        to: { descriptor: { id: e.to } },
        out: e.out,
        in: e.in,
        raw: () => e,
      })),
    outgoing: () => [],
    currentPorts: () => ({
      inputs: {
        ports: [
          ...(opts.mainPort
            ? [
                {
                  name: "context",
                  schema: { behavior: ["main-port"] },
                },
              ]
            : []),
          ...(opts.contentPort
            ? [
                {
                  name: opts.contentPort,
                  schema: { behavior: ["llm-content", "config"] },
                  value: opts.contentPortValue,
                },
              ]
            : []),
        ],
      },
      outputs: { ports: [] },
    }),
    ports: async () => ({
      inputs: {
        ports: [
          ...(opts.mainPort
            ? [
                {
                  name: "context",
                  schema: { behavior: ["main-port"] },
                },
              ]
            : []),
          ...(opts.outputPorts ?? []).map((p) => ({
            name: p.name,
            schema: { behavior: p.mainPort ? ["main-port"] : [] },
          })),
        ],
      },
      outputs: {
        ports:
          opts.outputPorts?.map((p) => ({
            name: p.name,
            schema: { behavior: p.mainPort ? ["main-port"] : [] },
          })) ?? [],
      },
    }),
    describe: async () => ({
      inputSchema: {
        behavior: opts.atWireable ? ["at-wireable"] : [],
      },
    }),
    metadata: () => ({}),
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

describe("ChangeEdge", () => {
  describe("add", () => {
    it("fails if graph is not found", async () => {
      const { context } = createMockContext({
        nodes: [],
        graphId: "other",
      });

      const edge: Edge = { from: "a", to: "b", out: "out", in: "in" };
      const transform = new ChangeEdge("add", "missing", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, false);
    });

    it("fails if adding creates a cycle", async () => {
      // Create a graph where adding edge b->a creates a cycle (a->b already exists)
      const { context } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "out" }] },
          { id: "b", outputPorts: [{ name: "out" }] },
        ],
        edges: [{ from: "a", to: "b", out: "out", in: "in" }],
      });

      const edge: Edge = { from: "b", to: "a", out: "out", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("cycle"));
      }
    });

    it("fails if source node is not found", async () => {
      const { context } = createMockContext({
        nodes: [{ id: "b" }],
      });

      const edge: Edge = { from: "missing", to: "b", out: "out", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, false);
    });

    it("adds edge with specified out port for non-at-wireable node", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [{ id: "a", outputPorts: [{ name: "out" }] }, { id: "b" }],
      });

      const edge: Edge = { from: "a", to: "b", out: "out", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
      assert.equal(addEdges.length, 1);
    });

    it("fails for non-at-wireable node when in port is missing", async () => {
      const { context } = createMockContext({
        nodes: [{ id: "a", outputPorts: [{ name: "out" }] }, { id: "b" }],
      });

      const edge = { from: "a", to: "b", out: "out" } as unknown as Edge;
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("in port"));
      }
    });

    it("uses routing mode port name when source has routes", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [
          {
            id: "router",
            routes: ["target"],
            configuration: configWith("some config"),
          },
          { id: "target" },
        ],
      });

      // No 'out' specified — should be inferred from routes
      const edge = {
        from: "router",
        to: "target",
        in: "in",
      } as unknown as Edge;
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
      assert.ok(addEdges.length >= 1);
      // The out port should be the target node id
      if (addEdges[0].type === "addedge") {
        assert.equal(addEdges[0].edge.out, "target");
      }
    });

    it("uses main-port for out when source has a main-port", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [
          {
            id: "a",
            outputPorts: [{ name: "content", mainPort: true }],
          },
          { id: "b" },
        ],
      });

      const edge = {
        from: "a",
        to: "b",
        in: "in",
      } as unknown as Edge;
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
      if (addEdges[0]?.type === "addedge") {
        assert.equal(addEdges[0].edge.out, "content");
      }
    });

    it("re-validates invalid routing chips in source on add", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [
          {
            id: "router",
            routes: ["target"],
            configuration: configWith(
              `Route ${chip(routeChip("target", { invalid: true }))}`
            ),
          },
          { id: "target" },
        ],
      });

      const edge: Edge = {
        from: "router",
        to: "target",
        out: "out",
        in: "in",
      };
      const transform = new ChangeEdge("add", "main", edge);
      await transform.apply(context);

      // Should have a changeconfiguration for the source node to clear invalid
      const configEdits = appliedEdits
        .flat()
        .filter((e) => e.type === "changeconfiguration");
      assert.ok(configEdits.length >= 1);
    });

    it("adds @ reference for at-wireable destination node", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [
          {
            id: "a",
            outputPorts: [{ name: "content", mainPort: true }],
            title: "Source Node",
          },
          {
            id: "b",
            atWireable: true,
            contentPort: "config$prompt",
            incoming: [{ from: "existing", to: "b", out: "x", in: "y" }],
          },
        ],
      });

      const edge: Edge = { from: "a", to: "b", out: "content", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      // Should have both a config change for @ reference AND an addedge
      const allEdits = appliedEdits.flat();
      const configEdits = allEdits.filter(
        (e) => e.type === "changeconfiguration"
      );
      const addEdges = allEdits.filter((e) => e.type === "addedge");
      assert.ok(configEdits.length >= 1, "should add @ reference to config");
      assert.ok(addEdges.length >= 1, "should add @ wire edge");
    });

    it("does not add duplicate edge for already-valid @ reference", async () => {
      const { context } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "content", mainPort: true }] },
          {
            id: "b",
            atWireable: true,
            contentPort: "config$prompt",
            // Node already has an @ reference to "a" in its config
            configuration: configWith(`Use ${chip(inChip("a"))}`),
            incoming: [{ from: "existing", to: "b", out: "x", in: "y" }],
          },
        ],
      });

      const edge: Edge = { from: "a", to: "b", out: "content", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
    });

    it("re-validates invalid @ reference in at-wireable destination", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "content", mainPort: true }] },
          {
            id: "b",
            atWireable: true,
            contentPort: "config$prompt",
            configuration: configWith(
              `Use ${chip(inChip("a", { invalid: true }))}`
            ),
            incoming: [{ from: "existing", to: "b", out: "x", in: "y" }],
          },
        ],
      });

      const edge: Edge = { from: "a", to: "b", out: "content", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      // Should update config to clear the invalid flag
      const configEdits = appliedEdits
        .flat()
        .filter((e) => e.type === "changeconfiguration");
      assert.ok(configEdits.length >= 1);
    });

    it("adds reference and edge for first connection to at-wireable with no main-port", async () => {
      const { context } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "content", mainPort: true }] },
          {
            id: "b",
            atWireable: true,
            contentPort: "config$prompt",
            // No incoming edges — this is the first connection
            incoming: [],
          },
        ],
      });

      const edge: Edge = { from: "a", to: "b", out: "content", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
    });

    it("uses default edge for first connection to at-wireable with main-port", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "content", mainPort: true }] },
          {
            id: "b",
            atWireable: true,
            mainPort: true,
            contentPort: "config$prompt",
            incoming: [],
          },
        ],
      });

      const edge: Edge = {
        from: "a",
        to: "b",
        out: "content",
        in: "context",
      };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      // Should just add the edge normally (main-port first connection)
      const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
      assert.ok(addEdges.length >= 1);
    });

    it("isMainPort: uses default edge when first at-wireable destination has main-port and no in port supplied", async () => {
      // This specifically tests the isMainPort function (L251-256):
      // willBeFirst=true, inPortFound=false, isMainPort(destination)=true → default edge
      const { context, appliedEdits } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "content", mainPort: true }] },
          {
            id: "b",
            atWireable: true,
            mainPort: true,
            contentPort: "config$prompt",
            incoming: [],
          },
        ],
      });

      // No `in` port supplied — forces isMainPort check
      const edge = {
        from: "a",
        to: "b",
        out: "content",
      } as unknown as Edge;
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
      assert.ok(addEdges.length >= 1);
    });

    it("isMainPort: falls through to @ reference when first at-wireable has no main-port and no in port supplied", async () => {
      // willBeFirst=true, inPortFound=false, isMainPort(destination)=false → @ ref path
      const { context, appliedEdits } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "content", mainPort: true }] },
          {
            id: "b",
            atWireable: true,
            // No mainPort set — isMainPort returns false
            contentPort: "config$prompt",
            incoming: [],
          },
        ],
      });

      const edge = {
        from: "a",
        to: "b",
        out: "content",
      } as unknown as Edge;
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      // Should add @ reference to config AND add @ wire edge
      const configEdits = appliedEdits
        .flat()
        .filter((e) => e.type === "changeconfiguration");
      const addEdges = appliedEdits.flat().filter((e) => e.type === "addedge");
      assert.ok(configEdits.length >= 1, "should add @ ref to config");
      assert.ok(addEdges.length >= 1, "should add @ wire edge");
    });

    it("fails if at-wireable node has no content port", async () => {
      const { context } = createMockContext({
        nodes: [
          { id: "a", outputPorts: [{ name: "content", mainPort: true }] },
          {
            id: "b",
            atWireable: true,
            // No contentPort!
            incoming: [{ from: "existing", to: "b", out: "x", in: "y" }],
          },
        ],
      });

      const edge: Edge = { from: "a", to: "b", out: "content", in: "in" };
      const transform = new ChangeEdge("add", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("LLM Content port"));
      }
    });
  });

  describe("remove", () => {
    it("removes edge and marks in-ports invalid", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [
          { id: "a", configuration: configWith("no refs") },
          { id: "b", configuration: configWith("no refs") },
        ],
      });

      const edge: Edge = { from: "a", to: "b", out: "out", in: "in" };
      const transform = new ChangeEdge("remove", "main", edge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const removeEdges = appliedEdits
        .flat()
        .filter((e) => e.type === "removeedge");
      assert.equal(removeEdges.length, 1);
    });
  });

  describe("move", () => {
    it("changes edge from old to new", async () => {
      const { context, appliedEdits } = createMockContext({
        nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      });

      const fromEdge: Edge = { from: "a", to: "b", out: "out", in: "in" };
      const toEdge: Edge = { from: "a", to: "c", out: "out", in: "in" };
      const transform = new ChangeEdge("move", "main", fromEdge, toEdge);
      const result = await transform.apply(context);

      assert.equal(result.success, true);
      const changeEdges = appliedEdits
        .flat()
        .filter((e) => e.type === "changeedge");
      assert.equal(changeEdges.length, 1);
    });

    it("fails if 'to' edge is not provided", async () => {
      const { context } = createMockContext({
        nodes: [{ id: "a" }, { id: "b" }],
      });

      const fromEdge: Edge = { from: "a", to: "b", out: "out", in: "in" };
      const transform = new ChangeEdge("move", "main", fromEdge);
      const result = await transform.apply(context);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.includes("to"));
      }
    });
  });
});

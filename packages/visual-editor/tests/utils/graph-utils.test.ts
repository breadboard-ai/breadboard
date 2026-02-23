/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyGraphSelectionState,
  createEmptyMultiGraphSelectionState,
  createEmptyGraphHighlightState,
  createSelectionChangeId,
  createNodeId,
  createEditChangeId,
  edgeToString,
  inspectableEdgeToString,
  generateBoardFrom,
  generateDeleteEditSpecFrom,
  generateAddEditSpecFromURL,
  generateAddEditSpecFromDescriptor,
  applyDefaultThemeInformationIfNonePresent,
  createAppPaletteIfNeeded,
  nodeIdsFromSpec,
  MAIN_BOARD_ID,
} from "../../src/utils/graph-utils.js";
import type {
  EditSpec,
  GraphDescriptor,
  InspectableEdge,
  InspectableGraph,
} from "@breadboard-ai/types";
import type {
  GraphSelectionState,
  MultiGraphSelectionState,
} from "../../src/utils/graph-types.js";
import { setDOM, unsetDOM } from "../fake-dom.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockGraph(raw: GraphDescriptor): InspectableGraph {
  const edgesList = (raw.edges ?? []).map((e) => ({
    raw: () => e,
    from: { descriptor: { id: e.from } },
    to: { descriptor: { id: e.to } },
  }));

  const subGraphs = raw.graphs
    ? Object.fromEntries(
        Object.entries(raw.graphs).map(([id, sub]) => [id, makeMockGraph(sub)])
      )
    : null;

  return {
    raw: () => raw,
    graphId: () => "",
    edges: () => edgesList,
    nodeById: (id: string) => {
      const node = raw.nodes.find((n) => n.id === id);
      if (!node) return undefined;
      return {
        descriptor: node,
        configuration: () => node.configuration ?? {},
      };
    },
    metadata: () => raw.metadata ?? null,
    graphs: () => subGraphs,
  } as unknown as InspectableGraph;
}

function makeSelection(
  graphId: string,
  partial: Partial<GraphSelectionState>
): MultiGraphSelectionState {
  const state = createEmptyMultiGraphSelectionState();
  const graphState = createEmptyGraphSelectionState();
  if (partial.nodes) {
    for (const n of partial.nodes) graphState.nodes.add(n);
  }
  if (partial.edges) {
    for (const e of partial.edges) graphState.edges.add(e);
  }
  if (partial.comments) {
    for (const c of partial.comments) graphState.comments.add(c);
  }
  if (partial.references) {
    for (const r of partial.references) graphState.references.add(r);
  }
  state.graphs.set(graphId, graphState);
  return state;
}

// ---------------------------------------------------------------------------
// MAIN_BOARD_ID
// ---------------------------------------------------------------------------

describe("graph-utils — MAIN_BOARD_ID", () => {
  it("is the string 'Main board'", () => {
    assert.equal(MAIN_BOARD_ID, "Main board");
  });
});

// ---------------------------------------------------------------------------
// Selection factories — existing tests kept + new ones
// ---------------------------------------------------------------------------

describe("graph-utils — selection factories", () => {
  describe("createEmptyGraphSelectionState", () => {
    it("creates state with empty sets", () => {
      const state = createEmptyGraphSelectionState();
      assert.equal(state.nodes.size, 0);
      assert.equal(state.assets.size, 0);
      assert.equal(state.assetEdges.size, 0);
      assert.equal(state.comments.size, 0);
      assert.equal(state.edges.size, 0);
      assert.equal(state.references.size, 0);
    });

    it("returns a new object each call", () => {
      const a = createEmptyGraphSelectionState();
      const b = createEmptyGraphSelectionState();
      assert.notEqual(a, b);
      assert.notEqual(a.nodes, b.nodes);
    });
  });

  describe("createEmptyMultiGraphSelectionState", () => {
    it("creates state with empty graphs map", () => {
      const state = createEmptyMultiGraphSelectionState();
      assert.equal(state.graphs.size, 0);
    });

    it("returns a new object each call", () => {
      const a = createEmptyMultiGraphSelectionState();
      const b = createEmptyMultiGraphSelectionState();
      assert.notEqual(a, b);
    });
  });

  describe("createEmptyGraphHighlightState", () => {
    it("creates state with empty sets", () => {
      const state = createEmptyGraphHighlightState();
      assert.equal(state.nodes.size, 0);
      assert.equal(state.comments.size, 0);
      assert.equal(state.edges.size, 0);
    });

    it("returns a new object each call", () => {
      const a = createEmptyGraphHighlightState();
      const b = createEmptyGraphHighlightState();
      assert.notEqual(a, b);
    });
  });
});

// ---------------------------------------------------------------------------
// ID generators
// ---------------------------------------------------------------------------

describe("graph-utils — ID generators", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  describe("createSelectionChangeId", () => {
    it("returns a UUID string", () => {
      assert.match(createSelectionChangeId(), UUID);
    });

    it("returns unique IDs", () => {
      assert.notEqual(createSelectionChangeId(), createSelectionChangeId());
    });
  });

  describe("createEditChangeId", () => {
    it("returns a UUID string", () => {
      assert.match(createEditChangeId(), UUID);
    });

    it("returns unique IDs", () => {
      assert.notEqual(createEditChangeId(), createEditChangeId());
    });
  });

  describe("createNodeId", () => {
    it("returns a UUID string", () => {
      assert.match(createNodeId(), UUID);
    });

    it("returns unique IDs", () => {
      assert.notEqual(createNodeId(), createNodeId());
    });
  });
});

// ---------------------------------------------------------------------------
// edgeToString / inspectableEdgeToString
// ---------------------------------------------------------------------------

describe("graph-utils — edge string conversion", () => {
  describe("edgeToString", () => {
    it("formats a normal edge", () => {
      const result = edgeToString({
        from: "nodeA",
        out: "output",
        to: "nodeB",
        in: "input",
      });
      assert.equal(result, "nodeA:output->nodeB:input");
    });

    it("handles wildcard edges", () => {
      const result = edgeToString({
        from: "nodeA",
        out: "*",
        to: "nodeB",
        in: "input",
      });
      assert.equal(result, "nodeA:*->nodeB:*");
    });

    it("handles empty port names", () => {
      const result = edgeToString({
        from: "a",
        out: "",
        to: "b",
        in: "",
      });
      assert.equal(result, "a:->b:");
    });
  });

  describe("inspectableEdgeToString", () => {
    it("delegates to edgeToString via raw()", () => {
      const mockEdge: Pick<InspectableEdge, "raw"> = {
        raw: () => ({
          from: "a",
          out: "x",
          to: "b",
          in: "y",
        }),
      };
      const result = inspectableEdgeToString(
        mockEdge as unknown as InspectableEdge
      );
      assert.equal(result, "a:x->b:y");
    });
  });
});

// ---------------------------------------------------------------------------
// nodeIdsFromSpec
// ---------------------------------------------------------------------------

describe("graph-utils — nodeIdsFromSpec", () => {
  it("extracts node IDs from addnode specs", () => {
    const specs: EditSpec[] = [
      { type: "addnode", node: { id: "n1", type: "foo" }, graphId: "" },
      { type: "addnode", node: { id: "n2", type: "bar" }, graphId: "" },
    ];
    const ids = nodeIdsFromSpec(specs);
    assert.equal(ids.size, 2);
    assert.ok(ids.has("n1"));
    assert.ok(ids.has("n2"));
  });

  it("ignores non-addnode specs", () => {
    const specs: EditSpec[] = [
      { type: "addnode", node: { id: "n1", type: "foo" }, graphId: "" },
      {
        type: "addedge",
        edge: { from: "a", out: "x", to: "b", in: "y" },
        graphId: "",
      },
      { type: "removenode", id: "n3", graphId: "" },
    ];
    const ids = nodeIdsFromSpec(specs);
    assert.equal(ids.size, 1);
    assert.ok(ids.has("n1"));
  });

  it("returns empty set for empty input", () => {
    assert.equal(nodeIdsFromSpec([]).size, 0);
  });

  it("returns empty set when no addnode specs exist", () => {
    const specs: EditSpec[] = [
      {
        type: "addedge",
        edge: { from: "a", out: "x", to: "b", in: "y" },
        graphId: "",
      },
    ];
    assert.equal(nodeIdsFromSpec(specs).size, 0);
  });
});

// ---------------------------------------------------------------------------
// generateAddEditSpecFromURL
// ---------------------------------------------------------------------------

describe("graph-utils — generateAddEditSpecFromURL", () => {
  const mockGraph = makeMockGraph({
    nodes: [],
    edges: [],
  });

  it("creates an addnode spec from a URL", () => {
    const specs = generateAddEditSpecFromURL(
      "https://example.com/boards/my-board",
      mockGraph
    );
    assert.equal(specs.length, 1);
    assert.equal(specs[0].type, "addnode");
    const spec = specs[0] as {
      type: "addnode";
      node: { type: string; metadata?: { title?: string; visual?: unknown } };
      graphId: string;
    };
    assert.equal(spec.node.type, "https://example.com/boards/my-board");
    assert.equal(spec.node.metadata?.title, "Board (my-board)");
    assert.equal(spec.graphId, "");
  });

  it("extracts the slug from the URL pathname", () => {
    const specs = generateAddEditSpecFromURL(
      "https://host.com/path/to/cool-board.json",
      mockGraph
    );
    const spec = specs[0] as {
      type: "addnode";
      node: { metadata?: { title?: string } };
    };
    assert.equal(spec.node.metadata?.title, "Board (cool-board.json)");
  });

  it("uses the provided pointer location", () => {
    const specs = generateAddEditSpecFromURL(
      "https://example.com/boards/test",
      mockGraph,
      { x: 100, y: 200 }
    );
    const spec = specs[0] as {
      type: "addnode";
      node: { metadata?: { visual?: { x: number; y: number } } };
    };
    assert.deepEqual(spec.node.metadata?.visual, { x: 100, y: 200 });
  });

  it("defaults pointer location to {0, 0}", () => {
    const specs = generateAddEditSpecFromURL(
      "https://example.com/boards/test",
      mockGraph
    );
    const spec = specs[0] as {
      type: "addnode";
      node: { metadata?: { visual?: { x: number; y: number } } };
    };
    assert.deepEqual(spec.node.metadata?.visual, { x: 0, y: 0 });
  });

  it("generates a unique node ID each time", () => {
    const specs1 = generateAddEditSpecFromURL(
      "https://example.com/b",
      mockGraph
    );
    const specs2 = generateAddEditSpecFromURL(
      "https://example.com/b",
      mockGraph
    );
    const id1 = (specs1[0] as { type: "addnode"; node: { id: string } }).node
      .id;
    const id2 = (specs2[0] as { type: "addnode"; node: { id: string } }).node
      .id;
    assert.notEqual(id1, id2);
  });
});

// ---------------------------------------------------------------------------
// generateBoardFrom
// ---------------------------------------------------------------------------

describe("graph-utils — generateBoardFrom", () => {
  it("filters nodes by selection", () => {
    const raw: GraphDescriptor = {
      nodes: [
        { id: "n1", type: "foo" },
        { id: "n2", type: "bar" },
        { id: "n3", type: "baz" },
      ],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, { nodes: new Set(["n1", "n3"]) });
    const result = generateBoardFrom(sel, graph);
    assert.equal(result.nodes.length, 2);
    assert.deepEqual(
      result.nodes.map((n) => n.id),
      ["n1", "n3"]
    );
  });

  it("filters edges — keeps only edges where both endpoints AND edge itself are selected", () => {
    const raw: GraphDescriptor = {
      nodes: [
        { id: "n1", type: "foo" },
        { id: "n2", type: "bar" },
      ],
      edges: [{ from: "n1", out: "x", to: "n2", in: "y" }],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      nodes: new Set(["n1", "n2"]),
      edges: new Set(["n1:x->n2:y"]),
    });
    const result = generateBoardFrom(sel, graph);
    assert.equal(result.edges.length, 1);
  });

  it("drops edges where an endpoint is not selected", () => {
    const raw: GraphDescriptor = {
      nodes: [
        { id: "n1", type: "foo" },
        { id: "n2", type: "bar" },
      ],
      edges: [{ from: "n1", out: "x", to: "n2", in: "y" }],
    };
    const graph = makeMockGraph(raw);
    // Select only n1 but not n2 — edge should be dropped
    const sel = makeSelection(MAIN_BOARD_ID, {
      nodes: new Set(["n1"]),
      edges: new Set(["n1:x->n2:y"]),
    });
    const result = generateBoardFrom(sel, graph);
    assert.equal(result.edges.length, 0);
  });

  it("filters comments by selection", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
      metadata: {
        comments: [
          { id: "c1", text: "hello", metadata: {} },
          { id: "c2", text: "world", metadata: {} },
        ],
      },
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      comments: new Set(["c1"]),
    });
    const result = generateBoardFrom(sel, graph);
    assert.equal(result.metadata?.comments?.length, 1);
    assert.equal(result.metadata?.comments?.[0].id, "c1");
  });

  it("strips assets, exports, and visual from metadata", () => {
    const raw: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo" }],
      edges: [],
      assets: {
        "asset-1": { kind: "inline", data: "aaa" },
      } as GraphDescriptor["assets"],
      exports: [{ type: "input" }] as unknown as GraphDescriptor["exports"],
      metadata: {
        visual: { window: { x: 0, y: 0, width: 100, height: 100 } },
      },
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      nodes: new Set(["n1"]),
    });
    const result = generateBoardFrom(sel, graph);
    assert.equal(result.assets, undefined);
    assert.equal(result.exports, undefined);
    assert.equal(result.metadata?.visual, undefined);
  });

  it("clears main board when not selected", () => {
    const raw: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo" }],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    // Empty selection — no MAIN_BOARD_ID entry
    const sel = createEmptyMultiGraphSelectionState();
    const result = generateBoardFrom(sel, graph);
    assert.equal(result.nodes.length, 0);
  });
});

// ---------------------------------------------------------------------------
// generateDeleteEditSpecFrom
// ---------------------------------------------------------------------------

describe("graph-utils — generateDeleteEditSpecFrom", () => {
  it("generates removenode specs for selected nodes", () => {
    const raw: GraphDescriptor = {
      nodes: [
        { id: "n1", type: "foo" },
        { id: "n2", type: "bar" },
      ],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      nodes: new Set(["n1"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const removeNodes = edits.filter((e) => e.type === "removenode");
    assert.equal(removeNodes.length, 1);
    assert.equal((removeNodes[0] as { id: string }).id, "n1");
  });

  it("generates removeedge specs for selected edges", () => {
    const edge = { from: "n1", out: "x", to: "n2", in: "y" };
    const raw: GraphDescriptor = {
      nodes: [
        { id: "n1", type: "foo" },
        { id: "n2", type: "bar" },
      ],
      edges: [edge],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      edges: new Set([edgeToString(edge)]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const removeEdges = edits.filter((e) => e.type === "removeedge");
    assert.equal(removeEdges.length, 1);
  });

  it("generates changegraphmetadata for selected comments", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
      metadata: {
        comments: [
          { id: "c1", text: "keep", metadata: {} },
          { id: "c2", text: "delete", metadata: {} },
        ],
      },
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      comments: new Set(["c2"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const metaEdits = edits.filter((e) => e.type === "changegraphmetadata");
    assert.equal(metaEdits.length, 1);
  });

  it("returns empty array for empty selection", () => {
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const sel = createEmptyMultiGraphSelectionState();
    const edits = generateDeleteEditSpecFrom(sel, graph);
    assert.equal(edits.length, 0);
  });

  it("converts MAIN_BOARD_ID to empty string in spec graphId", () => {
    const raw: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo" }],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      nodes: new Set(["n1"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const removeNode = edits.find((e) => e.type === "removenode") as {
      type: "removenode";
      graphId: string;
    };
    assert.equal(removeNode.graphId, "");
  });

  it("skips edges not found in the graph", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      edges: new Set(["nonexistent:x->missing:y"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const removeEdges = edits.filter((e) => e.type === "removeedge");
    assert.equal(removeEdges.length, 0);
  });

  it("generates changeconfiguration for selected references (array port)", () => {
    const raw: GraphDescriptor = {
      nodes: [
        {
          id: "n1",
          type: "foo",
          configuration: {
            context: ["item0", "item1", "item2"],
          },
        },
      ],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      references: new Set(["n1|context|1"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const configEdits = edits.filter((e) => e.type === "changeconfiguration");
    assert.equal(configEdits.length, 1);
    const cfg = (
      configEdits[0] as unknown as { configuration: { context: string[] } }
    ).configuration;
    // Index 1 ("item1") should be filtered out
    assert.deepEqual(cfg.context, ["item0", "item2"]);
  });

  it("generates changeconfiguration for references (non-array port deletes the port)", () => {
    const raw: GraphDescriptor = {
      nodes: [
        {
          id: "n1",
          type: "foo",
          configuration: {
            singleValue: "something",
          },
        },
      ],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      references: new Set(["n1|singleValue|0"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const configEdits = edits.filter((e) => e.type === "changeconfiguration");
    assert.equal(configEdits.length, 1);
    const cfg = (configEdits[0] as { configuration: Record<string, unknown> })
      .configuration;
    assert.equal(cfg.singleValue, undefined);
  });

  it("skips references with invalid format (missing parts)", () => {
    const raw: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo", configuration: { p: "v" } }],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      references: new Set(["malformed"]) as never,
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const configEdits = edits.filter((e) => e.type === "changeconfiguration");
    assert.equal(configEdits.length, 0);
  });

  it("skips references with non-numeric index", () => {
    const raw: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo", configuration: { p: "v" } }],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      references: new Set(["n1|p|abc"]) as never,
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const configEdits = edits.filter((e) => e.type === "changeconfiguration");
    assert.equal(configEdits.length, 0);
  });

  it("skips references when node has no configuration", () => {
    const raw: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo" }],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      references: new Set(["n1|p|0"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const configEdits = edits.filter((e) => e.type === "changeconfiguration");
    assert.equal(configEdits.length, 0);
  });

  it("skips references when port does not exist in configuration", () => {
    const raw: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo", configuration: { other: "something" } }],
      edges: [],
    };
    const graph = makeMockGraph(raw);
    const sel = makeSelection(MAIN_BOARD_ID, {
      references: new Set(["n1|missing|0"]),
    });
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const configEdits = edits.filter((e) => e.type === "changeconfiguration");
    assert.equal(configEdits.length, 0);
  });
});

// ---------------------------------------------------------------------------
// generateAddEditSpecFromDescriptor
// ---------------------------------------------------------------------------

describe("graph-utils — generateAddEditSpecFromDescriptor", () => {
  it("generates addnode specs for each node in the source", () => {
    const source: GraphDescriptor = {
      nodes: [
        { id: "n1", type: "foo", metadata: { visual: { x: 0, y: 0 } } },
        { id: "n2", type: "bar", metadata: { visual: { x: 100, y: 50 } } },
      ],
      edges: [],
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const addNodes = specs.filter((s) => s.type === "addnode");
    assert.equal(addNodes.length, 2);
  });

  it("generates addedge specs for edges in the source", () => {
    const source: GraphDescriptor = {
      nodes: [
        { id: "n1", type: "foo", metadata: { visual: { x: 0, y: 0 } } },
        { id: "n2", type: "bar", metadata: { visual: { x: 100, y: 0 } } },
      ],
      edges: [{ from: "n1", out: "x", to: "n2", in: "y" }],
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const addEdges = specs.filter((s) => s.type === "addedge");
    assert.equal(addEdges.length, 1);
  });

  it("remaps node IDs when they conflict with existing nodes", () => {
    const source: GraphDescriptor = {
      nodes: [
        { id: "existing", type: "foo", metadata: { visual: { x: 0, y: 0 } } },
      ],
      edges: [],
    };
    const graph = makeMockGraph({
      nodes: [{ id: "existing", type: "bar" }],
      edges: [],
    });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const addNode = specs.find((s) => s.type === "addnode") as {
      type: "addnode";
      node: { id: string };
    };
    assert.notEqual(addNode.node.id, "existing");
  });

  it("remaps edge endpoints when node IDs are remapped", () => {
    const source: GraphDescriptor = {
      nodes: [
        {
          id: "conflicting",
          type: "foo",
          metadata: { visual: { x: 0, y: 0 } },
        },
        { id: "other", type: "bar", metadata: { visual: { x: 100, y: 0 } } },
      ],
      edges: [{ from: "conflicting", out: "x", to: "other", in: "y" }],
    };
    const graph = makeMockGraph({
      nodes: [{ id: "conflicting", type: "baz" }],
      edges: [],
    });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const addEdge = specs.find((s) => s.type === "addedge") as {
      type: "addedge";
      edge: { from: string; to: string };
    };
    assert.notEqual(addEdge.edge.from, "conflicting");
  });

  it("copies comments and generates changegraphmetadata", () => {
    const source: GraphDescriptor = {
      nodes: [],
      edges: [],
      metadata: {
        comments: [
          { id: "c1", text: "A comment", metadata: { visual: { x: 0, y: 0 } } },
        ],
      },
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const metaEdits = specs.filter((s) => s.type === "changegraphmetadata");
    assert.equal(metaEdits.length, 1);
  });

  it("copies describer metadata", () => {
    const source: GraphDescriptor = {
      nodes: [],
      edges: [],
      metadata: { describer: "my-describer" },
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const metaEdits = specs.filter((s) => s.type === "changegraphmetadata");
    assert.equal(metaEdits.length, 1);
  });

  it("handles nodes without visual metadata", () => {
    const source: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo" }],
      edges: [],
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    // Should not throw
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 10, y: 20 },
      [""]
    );
    assert.ok(specs.length > 0);
  });

  it("processes subgraphs with nodes", () => {
    const source: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo", metadata: { visual: { x: 0, y: 0 } } }],
      edges: [],
      graphs: {
        sub1: {
          nodes: [
            { id: "s1", type: "baz", metadata: { visual: { x: 0, y: 0 } } },
          ],
          edges: [],
        },
      },
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const addNodes = specs.filter((s) => s.type === "addnode");
    assert.ok(addNodes.length >= 2); // main + subgraph nodes
  });

  it("skips empty subgraphs", () => {
    const source: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo", metadata: { visual: { x: 0, y: 0 } } }],
      edges: [],
      graphs: {
        empty: { nodes: [], edges: [] },
      },
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      [""]
    );
    const addNodes = specs.filter((s) => s.type === "addnode");
    assert.equal(addNodes.length, 1); // only the main node
  });

  it("skips non-existent target graphs", () => {
    const source: GraphDescriptor = {
      nodes: [{ id: "n1", type: "foo", metadata: { visual: { x: 0, y: 0 } } }],
      edges: [],
    };
    const graph = makeMockGraph({ nodes: [], edges: [] });
    const specs = generateAddEditSpecFromDescriptor(
      source,
      graph,
      { x: 0, y: 0 },
      ["nonexistent-subgraph"]
    );
    assert.equal(specs.length, 0);
  });
});

// ---------------------------------------------------------------------------
// applyDefaultThemeInformationIfNonePresent
// ---------------------------------------------------------------------------

describe("graph-utils — applyDefaultThemeInformationIfNonePresent", () => {
  it("returns early if graph already has themes + theme id", () => {
    const graph: GraphDescriptor = {
      nodes: [],
      edges: [],
      metadata: {
        visual: {
          presentation: {
            themes: { t1: {} as never },
            theme: "t1",
          },
        },
      },
    };
    applyDefaultThemeInformationIfNonePresent(graph);
    // Should not modify — still has only one theme
    assert.equal(
      Object.keys(graph.metadata!.visual!.presentation!.themes!).length,
      1
    );
  });

  it("applies default theme when no legacy themeColors present", () => {
    const graph: GraphDescriptor = { nodes: [], edges: [] };
    applyDefaultThemeInformationIfNonePresent(graph);
    assert.ok(graph.metadata?.visual?.presentation?.themes);
    assert.ok(graph.metadata?.visual?.presentation?.theme);
    const themeId = graph.metadata!.visual!.presentation!.theme!;
    const theme = graph.metadata!.visual!.presentation!.themes![themeId];
    assert.ok(theme);
    assert.equal((theme as { isDefaultTheme?: boolean }).isDefaultTheme, true);
  });

  it("migrates legacy themeColors to a new theme entry", () => {
    const graph: GraphDescriptor = {
      nodes: [],
      edges: [],
      metadata: {
        visual: {
          presentation: {
            themeColors: {
              primaryColor: "#ff0000",
              secondaryColor: "#00ff00",
              backgroundColor: "#0000ff",
              textColor: "#111",
              primaryTextColor: "#eee",
            },
            template: "fancy",
            templateAdditionalOptions: { opt: "val" },
          },
        },
      },
    };
    applyDefaultThemeInformationIfNonePresent(graph);
    // Legacy values should be removed
    assert.equal(graph.metadata!.visual!.presentation!.template, undefined);
    assert.equal(
      graph.metadata!.visual!.presentation!.templateAdditionalOptions,
      undefined
    );
    assert.equal(graph.metadata!.visual!.presentation!.themeColors, undefined);
    // Theme should be set
    const themeId = graph.metadata!.visual!.presentation!.theme!;
    const theme = graph.metadata!.visual!.presentation!.themes![themeId] as {
      themeColors: { primaryColor: string };
      template: string;
    };
    assert.equal(theme.themeColors.primaryColor, "#ff0000");
    assert.equal(theme.template, "fancy");
  });
});

// ---------------------------------------------------------------------------
// generateBoardFrom — subgraph filtering
// ---------------------------------------------------------------------------

describe("graph-utils — generateBoardFrom (subgraphs)", () => {
  it("includes selected subgraphs", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
      graphs: {
        sub1: { nodes: [{ id: "s1", type: "x" }], edges: [] },
        sub2: { nodes: [{ id: "s2", type: "y" }], edges: [] },
      },
    };
    const graph = makeMockGraph(raw);
    const sel = createEmptyMultiGraphSelectionState();
    sel.graphs.set("sub1", createEmptyGraphSelectionState());
    const result = generateBoardFrom(sel, graph);
    assert.ok(result.graphs?.sub1);
    assert.equal(result.graphs?.sub2, undefined);
  });

  it("filters subgraph contents by selection", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
      graphs: {
        sub1: {
          nodes: [
            { id: "s1", type: "x" },
            { id: "s2", type: "y" },
          ],
          edges: [],
        },
      },
    };
    const graph = makeMockGraph(raw);
    const sel = createEmptyMultiGraphSelectionState();
    const subSel = createEmptyGraphSelectionState();
    subSel.nodes.add("s1");
    sel.graphs.set("sub1", subSel);
    const result = generateBoardFrom(sel, graph);
    assert.equal(result.graphs?.sub1?.nodes?.length, 1);
    assert.equal(result.graphs?.sub1?.nodes?.[0]?.id, "s1");
  });
});

// ---------------------------------------------------------------------------
// generateDeleteEditSpecFrom — subgraph handling (L257-266)
// ---------------------------------------------------------------------------

describe("graph-utils — generateDeleteEditSpecFrom (subgraph handling)", () => {
  it("deletes nodes from a subgraph selection", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
      graphs: {
        sub1: {
          nodes: [
            { id: "s1", type: "foo" },
            { id: "s2", type: "bar" },
          ],
          edges: [{ from: "s1", out: "x", to: "s2", in: "y" }],
        },
      },
    };
    const graph = makeMockGraph(raw);
    const sel = createEmptyMultiGraphSelectionState();
    const subSel = createEmptyGraphSelectionState();
    subSel.nodes.add("s1");
    sel.graphs.set("sub1", subSel);
    const edits = generateDeleteEditSpecFrom(sel, graph);
    const removeNodes = edits.filter((e) => e.type === "removenode");
    assert.equal(removeNodes.length, 1);
  });

  it("skips when graph.graphs() returns null", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
    };
    const graph = {
      ...makeMockGraph(raw),
      graphs: () => null,
    } as unknown as InspectableGraph;
    const sel = createEmptyMultiGraphSelectionState();
    const subSel = createEmptyGraphSelectionState();
    subSel.nodes.add("s1");
    sel.graphs.set("sub1", subSel);
    const edits = generateDeleteEditSpecFrom(sel, graph);
    assert.equal(edits.length, 0);
  });

  it("skips when subgraph ID does not exist", () => {
    const raw: GraphDescriptor = {
      nodes: [],
      edges: [],
      graphs: {
        existing: { nodes: [], edges: [] },
      },
    };
    const graph = makeMockGraph(raw);
    const sel = createEmptyMultiGraphSelectionState();
    const subSel = createEmptyGraphSelectionState();
    subSel.nodes.add("s1");
    sel.graphs.set("nonexistent", subSel);
    const edits = generateDeleteEditSpecFrom(sel, graph);
    assert.equal(edits.length, 0);
  });
});

// ---------------------------------------------------------------------------
// applyDefaultThemeInformationIfNonePresent — splash screen asset (L551-554)
// ---------------------------------------------------------------------------

describe("graph-utils — applyDefaultThemeInformationIfNonePresent (splash asset)", () => {
  it("migrates splash screen asset into theme when present", () => {
    const graph: GraphDescriptor = {
      nodes: [],
      edges: [],
      metadata: {
        visual: {
          presentation: {
            themeColors: {
              primaryColor: "#ff0000",
              secondaryColor: "#00ff00",
              backgroundColor: "#ffffff",
              textColor: "#000",
              primaryTextColor: "#fff",
            },
            template: "basic",
          },
        },
      },
      assets: {
        "@@splash": {
          data: [
            {
              parts: [
                {
                  storedData: {
                    handle: "https://example.com/image.png",
                    mimeType: "image/png",
                  },
                },
              ],
            },
          ] as never,
        },
      },
    };
    applyDefaultThemeInformationIfNonePresent(graph);
    const themeId = graph.metadata!.visual!.presentation!.theme!;
    const theme = graph.metadata!.visual!.presentation!.themes![themeId] as {
      splashScreen?: { storedData: { handle: string } };
    };
    assert.ok(theme.splashScreen);
    assert.equal(
      theme.splashScreen.storedData.handle,
      "https://example.com/image.png"
    );
  });
});

// ---------------------------------------------------------------------------
// createAppPaletteIfNeeded
// ---------------------------------------------------------------------------

describe("graph-utils — createAppPaletteIfNeeded", () => {
  beforeEach(() => setDOM());
  afterEach(() => {
    unsetDOM();
    mock.restoreAll();
  });

  function makeThemeGraph(
    themeId: string,
    themeData: Record<string, unknown>,
    overrides: Partial<GraphDescriptor> = {}
  ): GraphDescriptor {
    return {
      nodes: [],
      edges: [],
      metadata: {
        visual: {
          presentation: {
            theme: themeId,
            themes: { [themeId]: themeData as never },
          },
        },
      },
      ...overrides,
    };
  }

  it("returns early when graph has no theme ID", async () => {
    const graph: GraphDescriptor = { nodes: [], edges: [] };
    await createAppPaletteIfNeeded(graph);
    // No changes — no theme metadata to modify
    assert.equal(graph.metadata, undefined);
  });

  it("returns early when theme does not exist in themes map", async () => {
    const graph = makeThemeGraph("t1", {});
    graph.metadata!.visual!.presentation!.themes = {}; // remove the theme
    await createAppPaletteIfNeeded(graph);
  });

  it("returns early when theme has no splashScreen", async () => {
    const graph = makeThemeGraph("t1", { template: "basic" });
    await createAppPaletteIfNeeded(graph);
  });

  it("returns early when theme already has a palette", async () => {
    const graph = makeThemeGraph("t1", {
      splashScreen: {
        storedData: {
          handle: "https://example.com/img.png",
          mimeType: "image/png",
        },
      },
      palette: { some: "existing-palette" },
    });
    await createAppPaletteIfNeeded(graph);
  });

  it("returns early when drive: handle has no googleDriveClient", async () => {
    const graph = makeThemeGraph("t1", {
      splashScreen: {
        storedData: { handle: "drive:file-id", mimeType: "image/png" },
      },
    });
    // No client provided — should return early
    await createAppPaletteIfNeeded(graph);
    const theme = graph.metadata!.visual!.presentation!.themes!["t1"] as {
      palette?: unknown;
    };
    assert.equal(theme.palette, undefined);
  });

  it("returns early when handle does not match any known pattern", async () => {
    const graph = makeThemeGraph("t1", {
      splashScreen: {
        storedData: { handle: "unknown-protocol:foo", mimeType: "image/png" },
      },
    });
    await createAppPaletteIfNeeded(graph);
    const theme = graph.metadata!.visual!.presentation!.themes!["t1"] as {
      palette?: unknown;
    };
    assert.equal(theme.palette, undefined);
  });
});

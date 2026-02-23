/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockGraph(raw: GraphDescriptor): InspectableGraph {
  const edgesList = (raw.edges ?? []).map((e) => ({
    raw: () => e,
    from: { descriptor: { id: e.from } },
    to: { descriptor: { id: e.to } },
  }));

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
    graphs: () => null,
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
});

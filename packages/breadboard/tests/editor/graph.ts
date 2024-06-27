/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { editGraph } from "../../src/editor/index.js";
import { NodeHandler } from "../../src/types.js";

export const testEditGraph = () => {
  return editGraph(
    structuredClone({
      nodes: [
        {
          id: "node0",
          type: "foo",
        },
        {
          id: "node2",
          type: "bar",
        },
      ],
      edges: [{ from: "node0", out: "out", to: "node0", in: "in" }],
    }),
    {
      kits: [
        {
          url: "",
          handlers: {
            foo: {
              invoke: async () => {},
              describe: async () => {
                return {
                  inputSchema: {
                    additionalProperties: false,
                    properties: {
                      in: { type: "string" },
                    },
                  },
                  outputSchema: {
                    additionalProperties: false,
                    properties: {
                      out: { type: "string" },
                    },
                  },
                };
              },
            } as NodeHandler,
            bar: {
              invoke: async () => {},
              describe: async () => {
                return {
                  inputSchema: {},
                  outputSchema: {
                    additionalProperties: false,
                    properties: {
                      out: { type: "string" },
                    },
                  },
                };
              },
            } as NodeHandler,
          },
        },
      ],
    }
  );
};

test("editor API successfully tests for node addition", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.edit(
      [
        {
          type: "addnode",
          node: {
            id: "node1",
            type: "foo",
          },
        },
      ],
      "add node",
      true
    );

    t.true(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "addnode",
          node: {
            id: "node0",
            type: "foo",
          },
        },
      ],
      "add node",
      true
    );

    t.false(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "addnode",
          node: {
            id: "node1",
            type: "unknown type",
          },
        },
      ],
      "add node",
      true
    );

    t.false(result.success);
  }
});

test("editor API successfully adds a node", async (t) => {
  const graph = testEditGraph();

  const result = await graph.edit(
    [
      {
        type: "addnode",
        node: {
          id: "node1",
          type: "foo",
        },
      },
    ],
    "add node"
  );

  t.true(result.success);

  const raw = graph.raw();
  t.deepEqual(
    raw.nodes.map((n) => n.id),
    ["node0", "node2", "node1"]
  );
});

test("editor API successfully tests for node removal", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.edit(
      [{ type: "removenode", id: "node0" }],
      "remove node",
      true
    );

    t.true(result.success);
  }
  {
    const result = await graph.edit(
      [{ type: "removenode", id: "node1" }],
      "remove node",
      true
    );

    t.false(result.success);
  }
});

test("editor API successfully removes a node", async (t) => {
  const graph = testEditGraph();
  {
    const result = await graph.edit(
      [{ type: "removenode", id: "node0" }],
      "remove node"
    );

    t.true(result.success);

    const raw = graph.raw();
    t.deepEqual(
      raw.nodes.map((n) => n.id),
      ["node2"]
    );
    t.deepEqual(
      raw.edges.map((e) => [e.from, e.to]),
      []
    );
  }

  {
    const result = await graph.edit(
      [{ type: "addnode", node: { id: "node0", type: "foo" } }],
      "add node",
      true
    );
    t.true(result.success);
  }
});

test("editor API successfully tests for edge addition", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "node0", out: "out", to: "node2", in: "in" },
        },
      ],
      "add edge",
      true
    );

    t.true(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "node0", out: "out", to: "node0", in: "in" },
        },
      ],
      "add edge",
      true
    );

    t.false(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "node0", out: "out", to: "node0", in: "baz" },
        },
      ],
      "add edge",
      true
    );

    t.false(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "unknown node", out: "out", to: "node2", in: "in" },
        },
      ],
      "add edge",
      true
    );

    t.false(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "node0", out: "out", to: "unknown node", in: "in" },
        },
      ],
      "add edge",
      true
    );

    t.false(result.success);
  }
});

test("editor API successfully adds an edge", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "node0", out: "out", to: "node2", in: "in" },
        },
      ],
      "add edge"
    );

    t.true(result.success);

    const raw = graph.raw();
    t.deepEqual(
      raw.edges.map((e) => [e.from, e.to]),
      [
        ["node0", "node0"],
        ["node0", "node2"],
      ]
    );
  }
  {
    const result = await graph.edit(
      [
        {
          type: "addedge",
          edge: { from: "node0", out: "out", to: "node2", in: "in" },
        },
      ],
      "add edge",
      true
    );

    t.false(result.success);
  }
});

test("editor API successfully tests for edge removal", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.edit(
      [
        {
          type: "removeedge",
          edge: { from: "node0", out: "out", to: "node0", in: "in" },
        },
      ],
      "remove edge",
      true
    );

    t.true(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "removeedge",
          edge: { from: "node0", out: "out", to: "node0", in: "baz" },
        },
      ],
      "remove edge",
      true
    );

    t.false(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "removeedge",
          edge: { from: "unknown node", out: "out", to: "node0", in: "in" },
        },
      ],
      "remove edge",
      true
    );

    t.false(result.success);
  }
  {
    const result = await graph.edit(
      [
        {
          type: "removeedge",
          edge: {
            from: "node0",
            out: "out",
            to: "unknown node",
            in: "in",
          },
        },
      ],
      "test",
      true
    );

    t.false(result.success);
  }
});

test("editor API successfully removes an edge", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.edit(
      [
        {
          type: "removeedge",
          edge: { from: "node0", out: "out", to: "node0", in: "in" },
        },
      ],
      "test"
    );

    t.true(result.success);

    const raw = graph.raw();
    t.deepEqual(
      raw.edges.map((e) => [e.from, e.to]),
      []
    );
  }
  {
    const result = await graph.edit(
      [
        {
          type: "removeedge",
          edge: { from: "node0", out: "out", to: "node0", in: "in" },
        },
      ],
      "test",
      true
    );

    t.false(result.success);
  }
});

test("editor API allows adding built-in nodes", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.edit(
      [
        {
          type: "addnode",
          node: {
            id: "node1",
            type: "input",
          },
        },
      ],
      "test"
    );

    t.true(result.success);

    const raw = graph.raw();
    t.deepEqual(
      raw.nodes.map((n) => n.id),
      ["node0", "node2", "node1"]
    );
  }

  {
    const result = await graph.edit(
      [
        {
          type: "addnode",
          node: { id: "node3", type: "output" },
        },
      ],
      "test"
    );

    t.true(result.success);

    const raw = graph.raw();
    t.deepEqual(
      raw.nodes.map((n) => n.id),
      ["node0", "node2", "node1", "node3"]
    );
  }
});

test("editor API allows changing edge", async (t) => {
  const graph = testEditGraph();

  const before = graph.inspect().edges()[0];

  const result = await graph.edit(
    [
      {
        type: "changeedge",
        from: { from: "node0", out: "out", to: "node0", in: "in" },
        to: { from: "node0", out: "out", to: "node2", in: "in" },
      },
    ],
    "test"
  );

  t.true(result.success);

  const raw = graph.raw();
  t.deepEqual(
    raw.edges.map((e) => [e.from, e.to]),
    [["node0", "node2"]]
  );

  const after = graph.inspect().edges()[0];
  t.assert(before === after);
});

test("editor API does not allow connecting a specific output port to a star port", async (t) => {
  const graph = testEditGraph();

  const edgeSpec = { from: "node0", out: "out", to: "node2", in: "*" };
  const result = await graph.edit(
    [{ type: "addedge", edge: edgeSpec }],
    "test",
    true
  );
  t.false(result.success);
});

test("editor API correctly works with no subgraphs", (t) => {
  const graph = testEditGraph();

  const raw = graph.raw();
  t.falsy(raw.graphs);
});

test("editor API correctly allows adding, removing, replacing subgraphs", (t) => {
  const graph = testEditGraph();
  const subgraph = testEditGraph().raw();

  t.assert(graph.addGraph("foo", subgraph) !== null);

  t.truthy(graph.raw().graphs);

  t.is(graph.version(), 1);

  t.assert(graph.addGraph("foo", subgraph) === null);

  t.true(graph.removeGraph("foo").success);
  t.false(graph.removeGraph("foo").success);

  t.falsy(graph.raw().graphs);

  t.is(graph.version(), 2);

  t.assert(graph.replaceGraph("foo", subgraph) === null);

  t.is(graph.version(), 2);

  t.assert(graph.addGraph("foo", subgraph) !== null);

  t.is(graph.version(), 3);

  t.assert(graph.replaceGraph("foo", subgraph) !== null);

  t.is(graph.version(), 4);

  t.truthy(graph.raw().graphs);
});

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { editGraph } from "../../src/editor/graph.js";
import { NodeHandler } from "../../src/types.js";

const testEditGraph = () => {
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
    const result = await graph.canAddNode({
      id: "node1",
      type: "foo",
    });

    t.true(result.success);
  }
  {
    const result = await graph.canAddNode({
      id: "node0",
      type: "foo",
    });

    t.false(result.success);
  }
  {
    const result = await graph.canAddNode({
      id: "node1",
      type: "unknown type",
    });

    t.false(result.success);
  }
});

test("editor API successfully adds a node", async (t) => {
  const graph = testEditGraph();

  const result = await graph.addNode({
    id: "node1",
    type: "foo",
  });

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
    const result = await graph.canRemoveNode("node0");

    t.true(result.success);
  }
  {
    const result = await graph.canRemoveNode("node1");

    t.false(result.success);
  }
});

test("editor API successfully removes a node", async (t) => {
  const graph = testEditGraph();
  {
    const result = await graph.removeNode("node0");

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
    const result = await graph.canAddNode({ id: "node0", type: "foo" });
    t.true(result.success);
  }
});

test("editor API successfully tests for edge addition", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.canAddEdge({
      from: "node0",
      out: "out",
      to: "node2",
      in: "in",
    });

    t.true(result.success);
  }
  {
    const result = await graph.canAddEdge({
      from: "node0",
      out: "out",
      to: "node0",
      in: "in",
    });

    t.false(result.success);
  }
  {
    const result = await graph.canAddEdge({
      from: "node0",
      out: "out",
      to: "node0",
      in: "baz",
    });

    t.false(result.success);
  }
  {
    const result = await graph.canAddEdge({
      from: "unknown node",
      out: "out",
      to: "node2",
      in: "in",
    });

    t.false(result.success);
  }
  {
    const result = await graph.canAddEdge({
      from: "node0",
      out: "out",
      to: "unknown node",
      in: "in",
    });

    t.false(result.success);
  }
});

test("editor API successfully adds an edge", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.addEdge({
      from: "node0",
      out: "out",
      to: "node2",
      in: "in",
    });

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
    const result = await graph.canAddEdge({
      from: "node0",
      out: "out",
      to: "node2",
      in: "in",
    });

    t.false(result.success);
  }
});

test("editor API successfully tests for edge removal", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.canRemoveEdge({
      from: "node0",
      out: "out",
      to: "node0",
      in: "in",
    });

    t.true(result.success);
  }
  {
    const result = await graph.canRemoveEdge({
      from: "node0",
      out: "out",
      to: "node0",
      in: "baz",
    });

    t.false(result.success);
  }
  {
    const result = await graph.canRemoveEdge({
      from: "unknown node",
      out: "out",
      to: "node0",
      in: "in",
    });

    t.false(result.success);
  }
  {
    const result = await graph.canRemoveEdge({
      from: "node0",
      out: "out",
      to: "unknown node",
      in: "in",
    });

    t.false(result.success);
  }
});

test("editor API successfully removes an edge", async (t) => {
  const graph = testEditGraph();

  {
    const result = await graph.removeEdge({
      from: "node0",
      out: "out",
      to: "node0",
      in: "in",
    });

    t.true(result.success);

    const raw = graph.raw();
    t.deepEqual(
      raw.edges.map((e) => [e.from, e.to]),
      []
    );
  }
  {
    const result = await graph.canRemoveEdge({
      from: "node0",
      out: "out",
      to: "node0",
      in: "in",
    });

    t.false(result.success);
  }
});

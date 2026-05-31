# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for graph plan creation (Kahn's topological sort).

Ported from visual-editor/tests/runtime/create-plan.ts.
"""

import pytest

from opal_backend.graph_plan import create_plan
from opal_backend.graph_types import Edge, GraphDescriptor, NodeDescriptor


def _graph(
    nodes: list[dict], edges: list[dict],
) -> GraphDescriptor:
    """Build a GraphDescriptor from compact dicts."""
    return GraphDescriptor(
        nodes=[NodeDescriptor(id=n["id"], type=n.get("type", "process"))
               for n in nodes],
        edges=[Edge(
            from_node=e["from"], to_node=e["to"],
            out_port=e.get("out"), in_port=e.get("in"),
        ) for e in edges],
    )


# ── basic functionality ──


class TestBasicFunctionality:
    def test_empty_graph(self):
        g = GraphDescriptor(nodes=[], edges=[])
        plan = create_plan(g)
        assert plan.stages == []

    def test_single_node_no_edges(self):
        g = _graph([{"id": "a"}], [])
        plan = create_plan(g)
        assert len(plan.stages) == 1
        assert len(plan.stages[0]) == 1
        assert plan.stages[0][0].node.id == "a"

    def test_multiple_standalone_nodes(self):
        g = _graph(
            [{"id": "a", "type": "input"},
             {"id": "b", "type": "process"},
             {"id": "c", "type": "output"}],
            [],
        )
        plan = create_plan(g)
        # All standalone — pick only the first one.
        assert len(plan.stages) == 1
        assert len(plan.stages[0]) == 1
        assert plan.stages[0][0].node.id == "a"


# ── linear graphs ──


class TestLinearGraphs:
    def test_sequential_stages(self):
        g = _graph(
            [{"id": "a", "type": "input"},
             {"id": "b", "type": "process"},
             {"id": "c", "type": "output"}],
            [{"from": "a", "to": "b", "out": "data", "in": "input"},
             {"from": "b", "to": "c", "out": "result", "in": "final"}],
        )
        plan = create_plan(g)
        assert len(plan.stages) == 3
        assert plan.stages[0][0].node.id == "a"
        assert plan.stages[1][0].node.id == "b"
        assert plan.stages[2][0].node.id == "c"

    def test_longer_linear_chain(self):
        g = _graph(
            [{"id": f"n{i}"} for i in range(1, 6)],
            [{"from": f"n{i}", "to": f"n{i+1}", "out": f"s{i}", "in": "input"}
             for i in range(1, 5)],
        )
        plan = create_plan(g)
        assert len(plan.stages) == 5
        for i, stage in enumerate(plan.stages):
            assert len(stage) == 1
            assert stage[0].node.id == f"n{i + 1}"


# ── parallel graphs ──


class TestParallelGraphs:
    def test_independent_branches(self):
        g = _graph(
            [{"id": "start", "type": "input"},
             {"id": "branch1"}, {"id": "branch2"},
             {"id": "end", "type": "output"}],
            [{"from": "start", "to": "branch1", "out": "data", "in": "input1"},
             {"from": "start", "to": "branch2", "out": "data", "in": "input2"},
             {"from": "branch1", "to": "end", "out": "r1", "in": "merge1"},
             {"from": "branch2", "to": "end", "out": "r2", "in": "merge2"}],
        )
        plan = create_plan(g)
        assert len(plan.stages) == 3

        assert plan.stages[0][0].node.id == "start"

        # Parallel stage.
        stage1_ids = {n.node.id for n in plan.stages[1]}
        assert stage1_ids == {"branch1", "branch2"}

        assert plan.stages[2][0].node.id == "end"

    def test_four_parallel_branches(self):
        g = _graph(
            [{"id": "input", "type": "input"},
             {"id": "p1"}, {"id": "p2"}, {"id": "p3"}, {"id": "p4"},
             {"id": "output", "type": "output"}],
            [{"from": "input", "to": f"p{i}", "out": "data", "in": f"input{i}"}
             for i in range(1, 5)]
            + [{"from": f"p{i}", "to": "output", "out": f"r{i}", "in": f"merge{i}"}
               for i in range(1, 5)],
        )
        plan = create_plan(g)
        assert len(plan.stages) == 3
        assert len(plan.stages[1]) == 4
        stage1_ids = {n.node.id for n in plan.stages[1]}
        assert stage1_ids == {"p1", "p2", "p3", "p4"}


# ── complex graphs ──


class TestComplexGraphs:
    def test_diamond_shaped(self):
        g = _graph(
            [{"id": "start", "type": "input"},
             {"id": "left"}, {"id": "right"},
             {"id": "merge", "type": "output"}],
            [{"from": "start", "to": "left", "out": "data", "in": "i1"},
             {"from": "start", "to": "right", "out": "data", "in": "i2"},
             {"from": "left", "to": "merge", "out": "r1", "in": "c1"},
             {"from": "right", "to": "merge", "out": "r2", "in": "c2"}],
        )
        plan = create_plan(g)
        assert len(plan.stages) == 3
        assert len(plan.stages[1]) == 2
        stage1_ids = {n.node.id for n in plan.stages[1]}
        assert stage1_ids == {"left", "right"}

    def test_multi_stage_parallel(self):
        g = _graph(
            [{"id": "input", "type": "input"},
             {"id": "s1a"}, {"id": "s1b"},
             {"id": "s2"},
             {"id": "s3a"}, {"id": "s3b"},
             {"id": "output", "type": "output"}],
            [{"from": "input", "to": "s1a", "out": "d", "in": "i1"},
             {"from": "input", "to": "s1b", "out": "d", "in": "i2"},
             {"from": "s1a", "to": "s2", "out": "r1", "in": "c1"},
             {"from": "s1b", "to": "s2", "out": "r2", "in": "c2"},
             {"from": "s2", "to": "s3a", "out": "p", "in": "i3"},
             {"from": "s2", "to": "s3b", "out": "p", "in": "i4"},
             {"from": "s3a", "to": "output", "out": "f1", "in": "m1"},
             {"from": "s3b", "to": "output", "out": "f2", "in": "m2"}],
        )
        plan = create_plan(g)
        assert len(plan.stages) == 5
        sizes = [len(s) for s in plan.stages]
        assert sizes == [1, 2, 1, 2, 1]


# ── node information ──


class TestNodeInfo:
    def test_downstream_populated(self):
        g = _graph(
            [{"id": "a", "type": "input"},
             {"id": "b"}, {"id": "c", "type": "output"}],
            [{"from": "a", "to": "b", "out": "data", "in": "input"},
             {"from": "b", "to": "c", "out": "result", "in": "final"}],
        )
        plan = create_plan(g)
        node_a = plan.stages[0][0]
        assert node_a.node.id == "a"
        assert len(node_a.downstream) == 1
        assert node_a.downstream[0].out_port == "data"

    def test_upstream_populated(self):
        g = _graph(
            [{"id": "a", "type": "input"},
             {"id": "b"}, {"id": "c", "type": "output"}],
            [{"from": "a", "to": "b", "out": "data", "in": "input"},
             {"from": "b", "to": "c", "out": "result", "in": "final"}],
        )
        plan = create_plan(g)
        node_b = plan.stages[1][0]
        assert node_b.node.id == "b"
        assert len(node_b.upstream) == 1
        assert node_b.upstream[0].in_port == "input"

    def test_multiple_dependencies(self):
        g = _graph(
            [{"id": "a", "type": "input"}, {"id": "b", "type": "input"},
             {"id": "c"}, {"id": "d", "type": "output"},
             {"id": "e", "type": "output"}],
            [{"from": "a", "to": "c", "out": "d1", "in": "i1"},
             {"from": "b", "to": "c", "out": "d2", "in": "i2"},
             {"from": "c", "to": "d", "out": "r1", "in": "f1"},
             {"from": "c", "to": "e", "out": "r2", "in": "f2"}],
        )
        plan = create_plan(g)
        node_c = plan.stages[1][0]
        assert node_c.node.id == "c"
        assert len(node_c.upstream) == 2
        assert len(node_c.downstream) == 2


# ── edge cases ──


class TestEdgeCases:
    def test_disconnected_components(self):
        g = _graph(
            [{"id": "a", "type": "input"}, {"id": "b"},
             {"id": "c", "type": "input"}, {"id": "d", "type": "output"}],
            [{"from": "a", "to": "b", "out": "d1", "in": "i1"},
             {"from": "c", "to": "d", "out": "d2", "in": "i2"}],
        )
        plan = create_plan(g)
        assert len(plan.stages) == 2
        stage0_ids = {n.node.id for n in plan.stages[0]}
        assert stage0_ids == {"a", "c"}
        stage1_ids = {n.node.id for n in plan.stages[1]}
        assert stage1_ids == {"b", "d"}


# ── port handling ──


class TestPortHandling:
    def test_port_names_preserved(self):
        g = _graph(
            [{"id": "llm", "type": "llm"},
             {"id": "transform", "type": "transform"}],
            [{"from": "llm", "to": "transform",
              "out": "completion", "in": "text"}],
        )
        plan = create_plan(g)
        llm = plan.stages[0][0]
        assert llm.downstream[0].out_port == "completion"

        transform = plan.stages[1][0]
        assert transform.upstream[0].in_port == "text"

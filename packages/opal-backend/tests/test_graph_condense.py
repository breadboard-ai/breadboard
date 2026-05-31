# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Tests for graph condensation (Tarjan SCC + subgraph folding).

Ported from visual-editor/tests/runtime/condense.ts.
"""

import pytest

from opal_backend.graph_condense import condense
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
        assert condense(g) is g

    def test_no_cycles(self):
        g = _graph(
            [{"id": "a"}, {"id": "b"}, {"id": "c"}],
            [{"from": "a", "to": "b", "out": "value", "in": "input"},
             {"from": "b", "to": "c", "out": "result", "in": "data"}],
        )
        result = condense(g)
        assert result is g  # No SCCs → same object.


# ── simple SCCs ──


class TestSimpleSCCs:
    def test_2_node_cycle(self):
        g = _graph(
            [{"id": "a"}, {"id": "b"}, {"id": "c"}],
            [{"from": "a", "to": "b", "out": "data", "in": "input"},
             {"from": "b", "to": "a", "out": "feedback", "in": "previous"},
             {"from": "b", "to": "c", "out": "result", "in": "final"}],
        )
        result = condense(g)

        assert len(result.nodes) == 2
        ids = {n.id for n in result.nodes}
        assert "c" in ids
        assert "scc_0" in ids

        assert result.graphs is not None
        sub = result.graphs["scc_0"]
        assert len(sub.nodes) == 4  # input, a, b, output
        sub_ids = {n.id for n in sub.nodes}
        assert "input_scc_0" in sub_ids
        assert "output_scc_0" in sub_ids
        assert "a" in sub_ids
        assert "b" in sub_ids

    def test_3_node_cycle(self):
        g = _graph(
            [{"id": "a"}, {"id": "b"}, {"id": "c"}],
            [{"from": "a", "to": "b", "out": "s1", "in": "input"},
             {"from": "b", "to": "c", "out": "s2", "in": "data"},
             {"from": "c", "to": "a", "out": "s3", "in": "loop"}],
        )
        result = condense(g)
        assert len(result.nodes) == 1
        assert result.nodes[0].id == "scc_0"
        assert result.nodes[0].type == "#scc_0"

        sub = result.graphs["scc_0"]
        assert len(sub.nodes) == 5  # input, a, b, c, output

    def test_self_loop(self):
        g = _graph(
            [{"id": "a"}, {"id": "b"}],
            [{"from": "a", "to": "a", "out": "state", "in": "previous"},
             {"from": "a", "to": "b", "out": "result", "in": "final"}],
        )
        result = condense(g)
        assert len(result.nodes) == 2
        ids = {n.id for n in result.nodes}
        assert "scc_0" in ids
        assert "b" in ids

        sub = result.graphs["scc_0"]
        assert any(n.id == "a" for n in sub.nodes)


# ── complex SCCs ──


class TestComplexSCCs:
    def test_multiple_separate_sccs(self):
        g = _graph(
            [{"id": "a"}, {"id": "b"}, {"id": "c"},
             {"id": "d"}, {"id": "e"}],
            [{"from": "a", "to": "b", "out": "d1", "in": "i1"},
             {"from": "b", "to": "a", "out": "f1", "in": "p1"},
             {"from": "c", "to": "d", "out": "d2", "in": "i2"},
             {"from": "d", "to": "c", "out": "f2", "in": "p2"},
             {"from": "b", "to": "c", "out": "connect", "in": "bridge"},
             {"from": "d", "to": "e", "out": "final", "in": "result"}],
        )
        result = condense(g)
        assert len(result.nodes) == 3  # 2 condensed + e
        assert result.graphs is not None
        assert "scc_0" in result.graphs
        assert "scc_1" in result.graphs

    def test_scc_with_external_connections(self):
        g = _graph(
            [{"id": "start", "type": "input"},
             {"id": "a"}, {"id": "b"}, {"id": "c"},
             {"id": "end", "type": "output"}],
            [{"from": "start", "to": "a", "out": "initial", "in": "seed"},
             {"from": "a", "to": "b", "out": "s1", "in": "input"},
             {"from": "b", "to": "c", "out": "s2", "in": "data"},
             {"from": "c", "to": "a", "out": "s3", "in": "loop"},
             {"from": "b", "to": "end", "out": "output", "in": "result"}],
        )
        result = condense(g)
        assert len(result.nodes) == 3  # start, scc_0, end
        ids = {n.id for n in result.nodes}
        assert {"start", "scc_0", "end"} == ids

        # Edge connections should be preserved.
        assert any(e.from_node == "start" and e.to_node == "scc_0"
                    for e in result.edges)
        assert any(e.from_node == "scc_0" and e.to_node == "end"
                    for e in result.edges)


# ── edge handling ──


class TestEdgeHandling:
    def test_preserve_edge_metadata(self):
        g = _graph(
            [{"id": "a"}, {"id": "b"}, {"id": "c"}],
            [{"from": "a", "to": "b", "out": "output", "in": "input"},
             {"from": "b", "to": "a", "out": "result", "in": "feedback"},
             {"from": "b", "to": "c", "out": "data", "in": "final"}],
        )
        result = condense(g)
        ext = [e for e in result.edges if e.to_node == "c"]
        assert len(ext) == 1
        assert ext[0].from_node == "scc_0"
        assert ext[0].out_port == "data"
        assert ext[0].in_port == "final"

    def test_port_names_in_subgraph(self):
        g = _graph(
            [{"id": "a"}, {"id": "b"}],
            [{"from": "a", "to": "b", "out": "primary", "in": "input"},
             {"from": "b", "to": "a", "out": "secondary", "in": "feedback"}],
        )
        result = condense(g)
        assert len(result.nodes) == 1
        sub = result.graphs["scc_0"]
        internal = [e for e in sub.edges
                     if e.from_node in ("a", "b") and e.to_node in ("a", "b")]
        assert any(e.out_port == "primary" and e.in_port == "input"
                    for e in internal)


# ── port mapping ──


class TestPortMapping:
    def test_incoming_ports_mapped_to_input_node(self):
        g = _graph(
            [{"id": "ext1", "type": "input"}, {"id": "ext2", "type": "input"},
             {"id": "a"}, {"id": "b"}, {"id": "out", "type": "output"}],
            [{"from": "ext1", "to": "a", "out": "data1", "in": "input1"},
             {"from": "ext2", "to": "b", "out": "data2", "in": "input2"},
             {"from": "a", "to": "b", "out": "s1", "in": "process"},
             {"from": "b", "to": "a", "out": "s2", "in": "feedback"},
             {"from": "b", "to": "out", "out": "result", "in": "final"}],
        )
        result = condense(g)
        sub = result.graphs["scc_0"]
        input_edges = [e for e in sub.edges if e.from_node == "input_scc_0"]
        assert any(e.to_node == "a" and e.in_port == "input1"
                    for e in input_edges)
        assert any(e.to_node == "b" and e.in_port == "input2"
                    for e in input_edges)

    def test_outgoing_ports_mapped_to_output_node(self):
        g = _graph(
            [{"id": "inp", "type": "input"}, {"id": "a"}, {"id": "b"},
             {"id": "ext1", "type": "output"}, {"id": "ext2", "type": "output"}],
            [{"from": "inp", "to": "a", "out": "seed", "in": "initial"},
             {"from": "a", "to": "b", "out": "s1", "in": "process"},
             {"from": "b", "to": "a", "out": "s2", "in": "feedback"},
             {"from": "a", "to": "ext1", "out": "result1", "in": "data1"},
             {"from": "b", "to": "ext2", "out": "result2", "in": "data2"}],
        )
        result = condense(g)
        sub = result.graphs["scc_0"]
        output_edges = [e for e in sub.edges if e.to_node == "output_scc_0"]
        assert any(e.from_node == "a" and e.out_port == "result1"
                    for e in output_edges)
        assert any(e.from_node == "b" and e.out_port == "result2"
                    for e in output_edges)

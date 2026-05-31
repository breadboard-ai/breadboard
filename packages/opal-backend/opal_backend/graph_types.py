# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Graph types for server-side graph execution (Project Heartstone).

Mirrors the subset of ``@breadboard-ai/types`` needed for graph
planning and execution. Only stdlib + typing — no external deps.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "Edge",
    "NodeDescriptor",
    "GraphDescriptor",
    "PlanNodeInfo",
    "GraphPlan",
    "NodeLifecycleState",
]


# ---------------------------------------------------------------------------
# Graph descriptor types (mirrors @breadboard-ai/types)
# ---------------------------------------------------------------------------


@dataclass
class Edge:
    """An edge in a graph, connecting two nodes via named ports.

    Attributes:
        from_node: Source node id (``from`` in the TS type).
        to_node: Target node id (``to`` in the TS type).
        out_port: Output port name on the source node.
        in_port: Input port name on the target node.
        optional: If true, this edge is not a required input.
        constant: If true, data persists after consumption.
    """

    from_node: str
    to_node: str
    out_port: str | None = None
    in_port: str | None = None
    optional: bool = False
    constant: bool = False

    @staticmethod
    def from_dict(d: dict[str, Any]) -> Edge:
        """Create an Edge from a BGL JSON dict."""
        return Edge(
            from_node=d["from"],
            to_node=d["to"],
            out_port=d.get("out"),
            in_port=d.get("in"),
            optional=d.get("optional", False),
            constant=d.get("constant", False),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to BGL JSON dict."""
        d: dict[str, Any] = {"from": self.from_node, "to": self.to_node}
        if self.out_port is not None:
            d["out"] = self.out_port
        if self.in_port is not None:
            d["in"] = self.in_port
        if self.optional:
            d["optional"] = True
        if self.constant:
            d["constant"] = True
        return d


@dataclass
class NodeDescriptor:
    """A node in a graph.

    Attributes:
        id: Unique node identifier.
        type: Node type identifier (handler lookup key).
        configuration: Static configuration values.
        metadata: Display metadata (title, tags, visual, etc.).
    """

    id: str
    type: str
    configuration: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None

    @staticmethod
    def from_dict(d: dict[str, Any]) -> NodeDescriptor:
        """Create a NodeDescriptor from a BGL JSON dict."""
        return NodeDescriptor(
            id=d["id"],
            type=d["type"],
            configuration=d.get("configuration"),
            metadata=d.get("metadata"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to BGL JSON dict."""
        d: dict[str, Any] = {"id": self.id, "type": self.type}
        if self.configuration is not None:
            d["configuration"] = self.configuration
        if self.metadata is not None:
            d["metadata"] = self.metadata
        return d


@dataclass
class GraphDescriptor:
    """A graph: nodes, edges, optional sub-graphs.

    Mirrors the shape of a ``.bgl.json`` file. Only the fields
    needed for planning and execution are included.
    """

    nodes: list[NodeDescriptor] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    graphs: dict[str, GraphDescriptor] | None = None
    title: str | None = None
    description: str | None = None

    @staticmethod
    def from_dict(d: dict[str, Any]) -> GraphDescriptor:
        """Create a GraphDescriptor from a BGL JSON dict."""
        graphs = None
        if "graphs" in d and d["graphs"]:
            graphs = {
                k: GraphDescriptor.from_dict(v)
                for k, v in d["graphs"].items()
            }
        return GraphDescriptor(
            nodes=[NodeDescriptor.from_dict(n) for n in d.get("nodes", [])],
            edges=[Edge.from_dict(e) for e in d.get("edges", [])],
            graphs=graphs,
            title=d.get("title"),
            description=d.get("description"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to BGL JSON dict."""
        d: dict[str, Any] = {
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
        }
        if self.graphs:
            d["graphs"] = {k: v.to_dict() for k, v in self.graphs.items()}
        if self.title is not None:
            d["title"] = self.title
        if self.description is not None:
            d["description"] = self.description
        return d


# ---------------------------------------------------------------------------
# Execution plan types
# ---------------------------------------------------------------------------


@dataclass
class PlanNodeInfo:
    """Detailed information computed during plan creation.

    Attributes:
        node: The node descriptor.
        downstream: Edges to nodes in later stages.
        upstream: Edges from nodes in earlier stages.
    """

    node: NodeDescriptor
    downstream: list[Edge] = field(default_factory=list)
    upstream: list[Edge] = field(default_factory=list)


@dataclass
class GraphPlan:
    """A staged execution plan for a condensed graph.

    Each stage is a group of nodes that can execute in parallel.
    Stages are ordered by dependency — all nodes in stage *n*
    must complete before any node in stage *n+1* begins.
    """

    stages: list[list[PlanNodeInfo]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Node lifecycle state
# ---------------------------------------------------------------------------

NodeLifecycleState = str
"""One of: inactive, ready, working, waiting, succeeded, failed, skipped,
interrupted. Kept as a string literal union for serialization simplicity."""

# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Graph plan creation — Kahn's topological sort.

Port of ``create-plan.ts`` from the visual-editor. Given a
condensed (acyclic) ``GraphDescriptor``, produces a ``GraphPlan``
of stages. Each stage is a group of nodes that can execute in
parallel. Stage *n* must complete before stage *n+1* begins.

Standalone nodes (no outgoing edges, in-degree 0) are handled
specially:
- If ALL entry nodes are standalone, pick only the first one.
- If some are standalone and some connected, ignore standalone.
- If none are standalone, start from all entry nodes.
"""

from __future__ import annotations

from .graph_types import Edge, GraphDescriptor, GraphPlan, PlanNodeInfo

__all__ = ["create_plan"]


def create_plan(graph: GraphDescriptor) -> GraphPlan:
    """Create a staged execution plan from a condensed graph.

    The input graph must be a DAG (run ``condense()`` first if it
    may contain cycles).
    """
    if not graph.nodes:
        return GraphPlan(stages=[])

    node_map = {node.id: node for node in graph.nodes}

    # Compute in-degree and adjacency.
    in_degree: dict[str, int] = {n.id: 0 for n in graph.nodes}
    out_edges: dict[str, list[Edge]] = {n.id: [] for n in graph.nodes}
    in_edges: dict[str, list[Edge]] = {n.id: [] for n in graph.nodes}

    for edge in graph.edges:
        in_degree[edge.to_node] = in_degree.get(edge.to_node, 0) + 1
        out_edges.setdefault(edge.from_node, []).append(Edge(
            from_node=edge.from_node,
            to_node=edge.to_node,
            out_port=edge.out_port,
            in_port=edge.in_port,
            optional=edge.optional,
            constant=edge.constant,
        ))
        in_edges.setdefault(edge.to_node, []).append(Edge(
            from_node=edge.from_node,
            to_node=edge.to_node,
            out_port=edge.out_port,
            in_port=edge.in_port,
            optional=edge.optional,
            constant=edge.constant,
        ))

    # Entry nodes = in-degree 0.
    entries = [n for n in graph.nodes if in_degree.get(n.id, 0) == 0]

    # Separate standalone (no outgoing edges) from connected.
    standalone = []
    connected = []
    only_standalone = True

    for node in entries:
        if not out_edges.get(node.id):
            standalone.append(node)
        else:
            only_standalone = False
            connected.append(node)

    if not standalone:
        queue = list(entries)
    elif only_standalone:
        # All isolated — just pick the first one.
        queue = [standalone[0]]
    else:
        # Mix of standalone and connected — ignore standalone.
        queue = list(connected)

    # Kahn's algorithm — level-by-level BFS.
    stages: list[list[PlanNodeInfo]] = []
    processed: set[str] = set()

    while queue:
        stage_nodes: list[PlanNodeInfo] = []
        next_queue = []

        for node in queue:
            if node.id in processed:
                continue
            processed.add(node.id)

            info = PlanNodeInfo(
                node=node_map[node.id],
                downstream=out_edges.get(node.id, []),
                upstream=in_edges.get(node.id, []),
            )
            stage_nodes.append(info)

            for edge in out_edges.get(node.id, []):
                deg = in_degree.get(edge.to_node, 0)
                if deg > 0:
                    in_degree[edge.to_node] = deg - 1
                    if deg == 1:
                        target = node_map.get(edge.to_node)
                        if target:
                            next_queue.append(target)

        if stage_nodes:
            stages.append(stage_nodes)

        queue = next_queue

    return GraphPlan(stages=stages, assets=graph.assets or {})

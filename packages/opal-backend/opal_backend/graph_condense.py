# Copyright 2026 Google LLC
# SPDX-License-Identifier: Apache-2.0

"""Graph condensation — Tarjan SCC + subgraph folding.

Port of ``condense.ts`` and ``nodes-to-subgraph.ts`` from the
visual-editor. Given a ``GraphDescriptor``, replaces every
strongly connected component (cycle) with a single node whose
type points at a subgraph (``#<subgraph_id>``).

The subgraph contains:
- An ``input`` node capturing incoming edge ports.
- An ``output`` node capturing outgoing edge ports.
- The original cycle nodes and their internal edges.

After condensation the graph is guaranteed to be a DAG, suitable
for topological sorting via ``create_plan()``.
"""

from __future__ import annotations

from dataclasses import dataclass

from .graph_types import Edge, GraphDescriptor, NodeDescriptor

__all__ = ["condense"]


def condense(graph: GraphDescriptor) -> GraphDescriptor:
    """Condense a graph by folding SCCs into subgraph nodes.

    Returns the original graph unchanged if no cycles exist.
    """
    if not graph.nodes or not graph.edges:
        return graph

    sccs = _find_sccs(graph)
    if not sccs:
        return graph

    return _create_condensed_graph(graph, sccs)


# ---------------------------------------------------------------------------
# Tarjan's SCC algorithm
# ---------------------------------------------------------------------------


@dataclass
class _TarjanState:
    index: int
    lowlink: int
    on_stack: bool


def _find_sccs(graph: GraphDescriptor) -> list[list[str]]:
    """Find all strongly connected components using Tarjan's algorithm.

    Returns only non-trivial SCCs (size > 1, or single node with
    self-loop).
    """
    node_states: dict[str, _TarjanState] = {}
    stack: list[str] = []
    sccs: list[list[str]] = []
    counter = [0]  # Mutable counter for nested function.

    # Pre-compute adjacency.
    successors: dict[str, list[str]] = {}
    for edge in graph.edges:
        successors.setdefault(edge.from_node, []).append(edge.to_node)

    def strong_connect(node_id: str) -> None:
        state = _TarjanState(
            index=counter[0], lowlink=counter[0], on_stack=True,
        )
        node_states[node_id] = state
        counter[0] += 1
        stack.append(node_id)

        for successor_id in successors.get(node_id, []):
            successor_state = node_states.get(successor_id)
            if successor_state is None:
                strong_connect(successor_id)
                updated = node_states[successor_id]
                state.lowlink = min(state.lowlink, updated.lowlink)
            elif successor_state.on_stack:
                state.lowlink = min(state.lowlink, successor_state.index)

        if state.lowlink == state.index:
            scc: list[str] = []
            while True:
                popped = stack.pop()
                node_states[popped].on_stack = False
                scc.append(popped)
                if popped == node_id:
                    break
            sccs.append(scc)

    for node in graph.nodes:
        if node.id not in node_states:
            strong_connect(node.id)

    # Filter trivial SCCs.
    self_loop_nodes = {
        e.from_node for e in graph.edges if e.from_node == e.to_node
    }
    return [
        scc for scc in sccs
        if len(scc) > 1 or scc[0] in self_loop_nodes
    ]


# ---------------------------------------------------------------------------
# Condensed graph creation
# ---------------------------------------------------------------------------


def _create_condensed_graph(
    graph: GraphDescriptor, sccs: list[list[str]],
) -> GraphDescriptor:
    """Create a new graph with SCCs folded into subgraph nodes."""
    condensed = GraphDescriptor(
        nodes=list(graph.nodes),
        edges=list(graph.edges),
        graphs=dict(graph.graphs) if graph.graphs else {},
        title=graph.title,
        description=graph.description,
        assets=graph.assets,
    )

    for i, scc in enumerate(sccs):
        subgraph_id = f"scc_{i}"
        _nodes_to_subgraph(
            condensed, scc, subgraph_id,
            title=f"SCC Subgraph {subgraph_id}",
            description="Subgraph containing strongly connected component",
        )

    return condensed


def _nodes_to_subgraph(
    graph: GraphDescriptor,
    node_group: list[str],
    subgraph_id: str,
    title: str | None = None,
    description: str | None = None,
) -> None:
    """Move a group of nodes into a subgraph, mutating *graph*.

    Port of ``nodesToSubgraph()`` from ``nodes-to-subgraph.ts``.
    """
    node_set = set(node_group)

    # Classify edges.
    internal: list[Edge] = []
    incoming: list[Edge] = []
    outgoing: list[Edge] = []

    for edge in graph.edges:
        f_in = edge.from_node in node_set
        t_in = edge.to_node in node_set
        if f_in and t_in:
            internal.append(edge)
        elif not f_in and t_in:
            incoming.append(edge)
        elif f_in and not t_in:
            outgoing.append(edge)

    # Group nodes.
    group_nodes = [n for n in graph.nodes if n.id in node_set]

    # Create input/output boundary nodes.
    input_node = NodeDescriptor(
        id=f"input_{subgraph_id}",
        type="input",
        metadata={
            "title": "Subgraph Input",
            "description": "Captures incoming edges to the subgraph",
        },
    )
    output_node = NodeDescriptor(
        id=f"output_{subgraph_id}",
        type="output",
        metadata={
            "title": "Subgraph Output",
            "description": "Captures outgoing edges from the subgraph",
        },
    )

    # Build subgraph edges.
    subgraph_edges = list(internal)

    for edge in incoming:
        subgraph_edges.append(Edge(
            from_node=f"input_{subgraph_id}",
            to_node=edge.to_node,
            in_port=edge.in_port,
            out_port=edge.in_port or "out",
        ))

    for edge in outgoing:
        subgraph_edges.append(Edge(
            from_node=edge.from_node,
            to_node=f"output_{subgraph_id}",
            in_port=edge.out_port or "in",
            out_port=edge.out_port,
        ))

    subgraph = GraphDescriptor(
        title=title or f"Subgraph {subgraph_id}",
        description=description or f"Subgraph containing {len(node_group)} nodes",
        nodes=[input_node, *group_nodes, output_node],
        edges=subgraph_edges,
    )

    # Store subgraph.
    if graph.graphs is None:
        graph.graphs = {}
    graph.graphs[subgraph_id] = subgraph

    # Replace folded nodes with a single subgraph node.
    replacement = NodeDescriptor(
        id=subgraph_id,
        type=f"#{subgraph_id}",
        metadata={"title": f'Subgraph "{subgraph_id}"', "tags": ["folded"]},
    )
    graph.nodes = [n for n in graph.nodes if n.id not in node_set]
    graph.nodes.append(replacement)

    # Rewrite cross-boundary edges.
    new_edges: list[Edge] = []
    for edge in graph.edges:
        f_in = edge.from_node in node_set
        t_in = edge.to_node in node_set

        if f_in and t_in:
            continue  # Internal — now in subgraph.
        if f_in and not t_in:
            new_edges.append(Edge(
                from_node=subgraph_id,
                to_node=edge.to_node,
                out_port=edge.out_port,
                in_port=edge.in_port,
                optional=edge.optional,
                constant=edge.constant,
            ))
        elif not f_in and t_in:
            new_edges.append(Edge(
                from_node=edge.from_node,
                to_node=subgraph_id,
                out_port=edge.out_port,
                in_port=edge.in_port,
                optional=edge.optional,
                constant=edge.constant,
            ))
        else:
            new_edges.append(edge)
    graph.edges = new_edges

from functools import reduce
from typing import Dict, List
from .traversal_types import Edge, GraphDescriptor, NodeDescriptor, NodeIdentifier

class GraphRepresentation():
    # Tails: a map of all outgoing edges, keyed by node id.
    tails: Dict[NodeIdentifier, List[Edge]] = {}

    # Heads: a map of all incoming edges, keyed by node id.
    heads: Dict[NodeIdentifier, List[Edge]] = {}

    # Nodes: a map of all nodes, keyed by node id.
    nodes: Dict[NodeIdentifier, NodeDescriptor] = {}

    # Entries: a list of all nodes that have no incoming edges.
    entries: List[NodeIdentifier] = []

    def __init__(self, descriptor: GraphDescriptor):
        self.nodes = {node.id: node for node in descriptor.nodes}
        self.tails = {}
        self.heads = {}
        for edge in descriptor.edges:
            previous = edge.previous
            if previous not in self.tails:
                self.tails[previous] = []
            self.tails[previous] = self.tails[previous] + [edge]

            next = edge.next
            if next not in self.heads:
                self.heads[next] = []
            self.heads[next] = self.heads[next] + [edge]

        self.entries = [tail for tail in self.tails.keys() if self.heads.get(tail, []) == []]
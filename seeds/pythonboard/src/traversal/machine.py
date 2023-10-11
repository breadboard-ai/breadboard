from .traversal_types import Edge, GraphDescriptor, TraversalResult, NodeDescriptor
from typing import Awaitable, List, Optional, Self
from .state import MachineEdgeState
from .representation import GraphRepresentation
from .result import MachineResult
from .iterator import TraversalMachineIterator

class TraversalMachine():
  graph: GraphRepresentation
  previousResult: Optional[TraversalResult]

  def __init__(self, descriptor: GraphDescriptor, result: Optional[TraversalResult] = None):
    self.graph = GraphRepresentation(descriptor)
    self.previousResult = result

  def __aiter__(self):
    return self.start()

  def start(self):
    if self.previousResult:
      return TraversalMachineIterator(self.graph, self.previousResult)

    entries = self.graph.entries
    if len(entries) == 0:
        raise Exception("No entry node found in graph.")
    # Create fake edges to represent entry points.
    opportunities = [Edge(previous="$entry", next=entry) for entry in entries]
    entryResult = MachineResult(
      NodeDescriptor(id="$empty", type="$empty"),
      {},
      [],
      opportunities,
      [],
      MachineEdgeState(),
      {},
    )
    return TraversalMachineIterator(self.graph, entryResult)

  @staticmethod
  async def prepareToSafe(result: TraversalResult) -> Awaitable[TraversalResult]:
    return await TraversalMachineIterator.processAllPendingNodes(result)

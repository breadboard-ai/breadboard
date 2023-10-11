from .traversal_types import (
  Edge,
  InputValues,
  NodeDescriptor,
)
from typing import List

class Traversal():
  """This class holds important parts of the graph traversal algorithm."""

  @staticmethod
  def computeMissingInputs(
    heads: List[Edge],
    inputs: InputValues,
    current: NodeDescriptor,
  ) -> List[str]:
    """Computes the missing inputs for a node. A missing input is an input that is
    required by the node, but is not (yet) available in the current state.
    @param heads All the edges that point to the node.
    @param inputs The input values that will be passed to the node
    @param current The node that is being visited.
    @returns Array of missing input names.
    """
    requiredInputs: List[str] = list(
      set(
        edge.input for edge in heads if edge.input and not edge.optional
      ),
    )
    inputsWithConfiguration = set(inputs.keys())
    if current.configuration:
      inputsWithConfiguration = inputsWithConfiguration | current.configuration.keys()
    return [i for i in requiredInputs if not i in inputsWithConfiguration]
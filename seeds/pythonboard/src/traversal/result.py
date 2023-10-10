from typing import Awaitable, Dict, List, Optional
from .state import MachineEdgeState
from .traversal_types import (
    Edge, InputValues, NodeDescriptor, OutputValues,
    CompletedNodeOutput,
    QueuedNodeValuesState,
    TraversalResult,
)

class MachineResult(TraversalResult):
    descriptor: NodeDescriptor
    inputs: InputValues
    missingInputs: List[str]
    opportunities: List[Edge]
    newOpportunities: List[Edge]
    state: QueuedNodeValuesState
    pendingOutputs: Dict[str, Awaitable[CompletedNodeOutput]]
    outputsPromise: Optional[Awaitable[OutputValues]] = None

    def __init__(
        self,
        descriptor: NodeDescriptor,
        inputs: InputValues,
        missingInputs: List[str],
        opportunities: List[Edge],
        newOpportunities: List[Edge],
        state: QueuedNodeValuesState,
        pendingOutputs: Dict[str, Awaitable[CompletedNodeOutput]]
    ):
        self.descriptor = descriptor
        self.inputs = inputs
        self.missingInputs = missingInputs
        self.opportunities = opportunities
        self.newOpportunities = newOpportunities
        self.state = state
        self.pendingOutputs = pendingOutputs

    @property
    def skip(self) -> bool:
        return len(self.missingInputs) > 0

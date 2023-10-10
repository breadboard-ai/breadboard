from enum import Enum
import json
from traversal.machine import TraversalMachine
from traversal.result import MachineResult
from traversal.traversal_types import (
    Edge,
    GraphDescriptor,
    InputValues,
    KitDescriptor,
    NodeConfiguration,
    NodeDescriptor,
    NodeHandlers,
    NodeTypeIdentifier,
    OutputValues,
    TraversalResult,
)
from typing import Dict, Optional, List, Self

class Kit(KitDescriptor):
  handlers : NodeHandlers

BreadboardSlotSpec = Dict[str, GraphDescriptor]

class RunResultType(Enum):
    INPUT = "input"
    OUTPUT = "output"
    BEFORE_HANDLER = "beforehandler"

class BreadboardRunResult():
  # Type of the run result. This property indicates where the board
  # currently is in the `run` process.
  type: RunResultType
  
  # The current node that is being visited. This property can be used to get
  # information about the current node, such as its id, type, and
  # configuration./
  node: NodeDescriptor
  
  # Any arguments that were passed to the `input` node that triggered this
  # stage.
  # Usually contains `message` property, which is a friendly message
  # to the user about what input is expected.
  # This property is only available when `ResultRunType` is `input`.
  @property
  def inputArguments(self) -> InputValues:
    pass

  @property
  def inputs(self) -> InputValues:
    pass

  # The input values the board is waiting for.
  # Set this property to provide input values.
  # This property is only available when `ResultRunType` is `input`.
  @inputs.setter
  def inputs(self, input: InputValues):
    pass
  
  # the output values the board is providing.
  # This property is only available when `ResultRunType` is `output`.
  @property
  def outputs(self) -> OutputValues:
    pass
  
  # Current state of the underlying graph traversal.
  # This property is useful for saving and restoring the state of
  # graph traversal.
  @property
  def state(self) -> TraversalResult:
    pass

class BreadboardRunResult():
  # The current node that is being visited. This property can be used to get
  # information about the current node, such as its id, type, and
  # configuration.
  node: NodeDescriptor

  # Returns `true` if the board is waiting for
  # input values. Returns `false` if the board is providing outputs.
  @property
  def seeksInputs(self) -> bool:
    pass

  # Any arguments that were passed to the `input` node that triggered this
  # stage.
  # Usually contains `message` property, which is a friendly message
  # to the user about what input is expected.
  # This property is only available when `seeksInputs` is `true`.
  @property
  def inputArguments(self)-> InputValues:
    pass

  @property
  def inputs(self) -> InputValues:
    pass
  
  # The input values the board is waiting for.
  # Set this property to provide input values.
  # This property is only available when `seeksInputs` is `true`.
  @inputs.setter
  def inputs(self, input: InputValues):
    pass
  
  # the output values the board is providing.
  # This property is only available when `seeksInputs` is `false`.
  @property
  def outputs(self) -> OutputValues:
    pass

class BreadboardNode():
  def wire(
    self,
    spec: str,
    to: Self
  ) -> Self:
    """Wires the current node to another node.

    Use this method to wire nodes together.

    @param spec - the wiring spec. See the [wiring spec](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/wires.md) for more details.
    @param to - the node to wire this node with.
    @returns - the current node, to enable chaining.
    """
    pass

class NodeFactory():
  def create(
    type: NodeTypeIdentifier,
    configuration: Optional[NodeConfiguration],
    id: Optional[str],
  ) ->BreadboardNode:
    pass

class KitConstructor():
  def __init__(self, nodeFactory: NodeFactory):
    pass


class BreadboardValidatorMetadata():
  """Validator metadata for a node.
  Used e.g. in ProbeDetails.
  """
  description: str

class BreadboardValidator():
  """A validator for a breadboard.
    For example to check integrity using information flow control.
  """

  def addGraph(graph: GraphDescriptor) -> None:
    """Add a graph and validate it.

    @param graph The graph to validate.
    @throws Error if the graph is invalid.
    """
    pass

  def getValidatorMetadata(node: NodeDescriptor) -> BreadboardValidatorMetadata:
    """Gets the validation metadata for a node.

    @param node Node to get metadata for.
    """
    pass

  def getSubgraphValidator(
    node: NodeDescriptor,
    actualInputs: Optional[List[str]],
  ) -> Self:
    """Generate a validator for a subgraph, replacing a given node. Call
    .addGraph() on the returned validator to add and validate the subgraph.

    @param node The node to replace.
    @param actualInputs Actual inputs to the node (as opposed to assuming all
    inputs with * or that optional ones are present)
    @returns A validator for the subgraph.
    """
    pass

class ProbeDetails():
  """Details of the `ProbeEvent` event."""
  # Internal representation of the node that is placed on the board.
  descriptor: NodeDescriptor
  
  # The input values the node was passed.
  inputs: InputValues
  
  # Any missing inputs that the node was expecting.
  # This property is only populated for `skip` event.
  missingInputs: Optional[List[str]]

  # The output values the node provided.
  outputs: Optional[OutputValues]
  
  # The nesting level of the node.
  # When a board contains included or slotted boards, this level will
  # increment for each level of nesting.
  nesting: Optional[int]
  sources: Optional[List[str]]
  validatorMetadata: Optional[List[BreadboardValidatorMetadata]]

class CustomEvent():
  pass

class EventListener():
  pass

# A probe event that is dispatched during board run.
#
# See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) for more information.
class ProbeEvent(CustomEvent):
  def __init__(self, type: str, detail: ProbeDetails):
    #super(type, { detail, cancelable: true });
    self.type = type
    self.detail = detail

class Breadboard(GraphDescriptor):
  def addEdge(edge: Edge) -> None:
    pass
  def addNode(node: NodeDescriptor) -> None:
    pass
  def addKit(ctr: KitConstructor) -> Kit:
    pass

"""
/**
 * A node configuration that can optionally have an `$id` property.
 *
 * The `$id` property is used to identify the node in the board and is not
 * passed to the node itself.
 */
OptionalIdConfiguration = { $id?: string } & NodeConfiguration;

ReflectNodeOutputs = OutputValues & {
  graph: GraphDescriptor;
};

IncludeNodeInputs = InputValues & {
  path: Optional[str]
  $ref: Optional[str]
  graph: Optional[GraphDescriptor]
  slotted: Optional[BreadboardSlotSpec]
  parent: NodeDescriptor
  args: InputValues
};
"""

class SlotNodeInputs():
  slot: str
  parent: NodeDescriptor

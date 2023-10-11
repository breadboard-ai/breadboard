from typing import Awaitable, Callable, Dict, List, Optional, Tuple, Union
from dataclasses import asdict, dataclass, field
from dataclasses_json import dataclass_json

from typing import Any, Self

class Capability():
  kind: str

# A type representing a valid JSON value.
NodeValue = Union[str, int, bool, None, List[Self], Capability, Dict[str, Self]]

# Unique identifier of a node in a graph.
NodeIdentifier = str

# Unique identifier of a node's output.
OutputIdentifier = str

# Unique identifier of a node's input.
InputIdentifier = str

# Unique identifier of a node's type.
NodeTypeIdentifier = str

# Values that the `NodeHandler` outputs.
OutputValues = Dict[OutputIdentifier, NodeValue]

# The Map of queues of all outputs that were sent to a given node,
# and a map of these for all nodes.
NodeValuesQueues = Dict[str, List[NodeValue]]

NodeValuesQueuesMap = Dict[NodeIdentifier, NodeValuesQueues]

# Values that are supplied as inputs to the `NodeHandler`.
InputValues = Dict[InputIdentifier, NodeValue]

"""Values that are supplied as part of the graph. These values are merged with
the `InputValues` and supplied as inputs to the `NodeHandler`.
"""
NodeConfiguration = Dict[str, NodeValue]

"""A function that represents a type of a node in the graph."""
NodeHandler = Callable[[InputValues], Awaitable[Optional[OutputValues]]]

# All known node handlers.
NodeHandlers = Dict[NodeTypeIdentifier, NodeHandler]

@dataclass
class NodeDescriptor():
  """Represents a node in a graph."""

  # Unique id of the node in graph.
  id: NodeIdentifier

  # Type of the node. Used to look up the handler for the node.
  type: NodeTypeIdentifier

  # Configuration of the node.
  configuration: Optional[NodeConfiguration] = None

  def to_dict(self):
    data = asdict(self)
    if data.get('configuration') is None:
      data.pop('configuration')
    return data

@dataclass_json
@dataclass
class ErrorCapability(Capability):
  kind: str = "error"
  error: Optional[Exception] = None
  inputs: Optional[InputValues] = None
  descriptor: Optional[NodeDescriptor] = None

@dataclass_json
@dataclass
class GraphMetadata():
  """Represents graph metadata."""

  # The URL pointing to the location of the graph.
  # This URL is used to resolve relative paths in the graph.
  # If not specified, the paths are assumed to be relative to the current
  # working directory.
  url: Optional[str] = field(default=None, kw_only=True)

  # The title of the graph.
  title: Optional[str] = field(default=None, kw_only=True)

  # The description of the graph.
  description: Optional[str] = field(default=None, kw_only=True)

  # Version of the graph.
  # [semver](https://semver.org/) format is encouraged.
  version: Optional[str] = field(default=None, kw_only=True)

# Unique identifier of a graph.
GraphIdentifier = str

@dataclass_json
@dataclass
class Edge():
  """Represents an edge in a graph."""

  # The node that the edge is coming from.
  previous: NodeIdentifier

  # The node that the edge is going to.
  next: NodeIdentifier

  # The input of the `next` node. If this value is undefined, then
  # the then no data is passed as output of the `from` node.
  input: Optional[InputIdentifier] = None

  # The output of the `previous` node. If this value is "*", then all outputs
  # of the `previous` node are passed to the `next` node. If this value is undefined,
  # then no data is passed to any inputs of the `next` node.
  out: Optional[OutputIdentifier] = None

  # If true, this edge is optional: the data that passes through it is not
  # considered a required input to the node.
  optional: Optional[bool] = None

  # If true, this edge acts as a constant: the data that passes through it
  # remains available even after the node has consumed it.
  constant: Optional[bool] = None

class KitDescriptor():
  """Represents a "kit": a collection of `NodeHandlers`. The basic permise here
  is that people can publish kits with interesting handlers, and then
  graphs can specify which ones they use.
  The `@google-labs/llm-starter` package is an example of kit.
  """

  # The URL pointing to the location of the kit.
  url: str

  # The list of node types in this kit that are used by the graph.
  # If left blank or omitted, all node types are assumed to be used.
  using: Optional[List[str]]

@dataclass_json
@dataclass
class GraphDescriptor(GraphMetadata):
  """Represents a graph."""

  # The collection of all edges in the graph.
  edges: List[Edge]

  # The collection of all nodes in the graph.
  nodes: List[NodeDescriptor]

  # All the kits (collections of node handlers) that are used by the graph.
  kits: Optional[List[KitDescriptor]] = field(default=None, kw_only=True)

  # Sub-graphs that are also described by this graph representation.
  graphs: Optional[Dict[GraphIdentifier, Self]] = field(default=None, kw_only=True)

# Represents a collection of sub-graphs.
# The key is the identifier of the sub-graph.
# The value is the descriptor of the sub-graph.
SubGraphs = Dict[GraphIdentifier, GraphDescriptor]

class QueuedNodeValuesState():
  state: NodeValuesQueuesMap
  constants: NodeValuesQueuesMap

  def wireOutputs(self, opportunites: List[Edge], outputs: OutputValues) -> None:
    pass

  def getAvailableInputs(self, nodeId: NodeIdentifier) -> InputValues:
    pass

  def useInputs(self, node: NodeIdentifier, inputs: InputValues) -> None:
    pass

@dataclass
class CompletedNodeOutput():
  promiseId: str
  outputs: OutputValues
  newOpportunities: List[Edge]

@dataclass
class TraversalResult():
  descriptor: NodeDescriptor
  inputs: InputValues
  missingInputs: List[str]
  opportunities: List[Edge]
  newOpportunities: List[Edge]
  state: QueuedNodeValuesState
  outputsPromise: Optional[Awaitable[OutputValues]]
  pendingOutputs: Dict[str, Awaitable[CompletedNodeOutput]]
  skip: bool
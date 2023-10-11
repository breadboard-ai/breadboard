
from traversal.traversal_types import (
  GraphDescriptor,
  InputValues,
  NodeHandler,
  NodeHandlers,
  OutputValues,
)
from breadboard_types import (
  BreadboardSlotSpec,
  BreadboardValidator,
  Kit,
  EventListener,
)
import copy
from typing import List, Optional

CORE_HANDLERS = ["include", "reflect", "slot", "passthrough"]

class Core(Kit):
  _graph: GraphDescriptor
  _slots: BreadboardSlotSpec
  _validators: List[BreadboardValidator]
  _probe: Optional[EventListener] = None
  _outerGraph: Optional[GraphDescriptor] = None
  handlers: NodeHandlers = {}

  def __init__(
    self,
    graph: GraphDescriptor,
    slots: BreadboardSlotSpec,
    validators: List[BreadboardValidator],
    outerGraph: Optional[GraphDescriptor] = None,
    probe: Optional[EventListener] = None,
  ):
    self._graph = graph
    self._slots = slots
    self._validators = validators
    self._probe = probe
    self._outerGraph = outerGraph or graph
    for handler_type in CORE_HANDLERS:
      self.handlers[handler_type] = Core.__dict__[handler_type]

  async def include(self, inputs: InputValues) -> OutputValues:
    from breadboard import Board
    args = inputs.copy()
    path = inputs.pop('path')
    ref = inputs.pop('ref')
    graph = inputs.pop('graph')
    slotted = inputs.pop('slotted')
    parent = inputs.pop('parent')

    # Add the current graph's URL as the url of the slotted graph,
    # if there isn't an URL already.
    slottedWithUrls: BreadboardSlotSpec = {}
    if slotted:
      for key in slotted:
        slottedWithUrls[key] = slotted[key]
        if "url" not in slottedWithUrls[key]:
          slottedWithUrls[key] = self._graph.url

    # TODO: Please fix the $ref/path mess.
    source = path or ref or ""
    board = await Board.fromGraphDescriptor(graph) if graph else await Board.load(
      source,
      slotted=slottedWithUrls,
      base=self._graph.url,
      outerGraph=self._outerGraph,
    )
    for validator in self._validators:
      board.addValidator(
        validator.getSubgraphValidator(parent, Object.keys(args))
      )
    return await board.runOnce(args, NestedProbe.create(self._probe, source))

  @staticmethod
  async def reflect(_inputs: InputValues) -> OutputValues:
    graph = copy.deepCopy(self._graph)
    return graph.__dict__

  @staticmethod
  async def slot(inputs: InputValues) -> OutputValues:
    from breadboard import Board
    args = inputs.copy()
    slot = args.pop('slot')
    parent = args.pop('parent')
    if not slot:
      raise Exception("To use a slot, we need to specify its name")
    graph = self._slots[slot]
    if not graph:
      raise Exception(f'No graph found for slot "{slot}"')
    slottedBreadboard = await Board.fromGraphDescriptor(graph)
    for validator in self._validators:
      slottedBreadboard.addValidator(validator.getSubgraphValidator(parent))
    return await slottedBreadboard.runOnce(
      args,
      NestedProbe.create(self._probe, slot)
    )

  @staticmethod
  async def passthrough(inputs: InputValues) -> OutputValues:
    return inputs

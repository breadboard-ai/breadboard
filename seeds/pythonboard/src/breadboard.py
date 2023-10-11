from typing import Any, Dict, List, Optional, Self
from traversal.traversal_types import (
  Edge,
  NodeDescriptor,
  NodeHandlers,
  GraphDescriptor,
  NodeHandler,
  SubGraphs,
  GraphMetadata,
)
#from node import Node
from breadboard_types import (
  Breadboard,
  BreadboardSlotSpec,
  Kit,
  KitConstructor,
  BreadboardValidator,
  ProbeEvent,
  EventListener,
)
from core import Core
from traversal.machine import TraversalMachine
from run import InputStageResult, OutputStageResult, BeforeHandlerStageResult, RunResult
import javascript
from dataclasses import asdict, dataclass, field
import asyncio
from util import wrap_future

class LocalKit(Kit):
  # The "." signifies local.
  url = "."

  handlers: NodeHandlers = {}

  def addHandler(self, type: str, handler: NodeHandler):
    self.handlers[type] = handler

@dataclass
class Board(GraphDescriptor):
  #edges: List[Edge]
  #nodes: List[NodeDescriptor]
  kits: List[Kit] = field(default_factory=list)
  ctr: List[Kit] = field(default_factory=list)
  handlers: Dict[str, Any] = field(default_factory=dict)
  graphs: Optional[SubGraphs] = None
  _localKit: Optional[LocalKit] = None
  _slots: BreadboardSlotSpec = field(default_factory=dict)
  _validators: List[BreadboardValidator] = field(default_factory=list)

  # The parent board, if this is board is a subgraph of a larger board.
  _parent: Optional[GraphDescriptor] = None

  def addKit(self, ctr: KitConstructor) -> Kit:
    kit = ctr({
      "create": lambda **args : Node(self, **args)
    })
    # Keeps a reference to the constructor and kit.
    #self.ctr.append(ctr)
    self.kits.append(kit)
    return kit

  async def run(
    self,
    probe: Optional[EventListener] = None,
    slots: Optional[BreadboardSlotSpec] = None,
    result: Optional[RunResult] = None,
  ):
    """Runs the board. This method is an async generator that
    yields the results of each stage of the run.
   
    Conceptually, when we ask the board to run, it will occasionally pause
    and give us a chance to interact with it.
   
    It's typically used like this:
   
    ```python
    async for res in board.run():
      # do something with `stop`
    ```
   
    The `stop` iterator result will be a `RunResult` and provide ability
    to influence running of the board.
   
    The two key use cases are providing input and receiving output.
   
    If `stop.type` is `input`, the board is waiting for input values.
    When that is the case, use `stop.inputs` to provide input values.
   
    If `stop.type` is `output`, the board is providing output values.
    When that is the case, use `stop.outputs` to receive output values.
   
    See [Chapter 8: Continuous runs](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial for an example of how to use this method.
   
    @param probe - an optional probe. If provided, the board will dispatch
    events to it. See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) of the Breadboard tutorial for more information.
    @param slots - an optional map of slotted graphs. See [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of the Breadboard tutorial for more information.
    """
    handlers = self.handlersFromBoard(probe, slots)

    for validator in self._validators:
      validator.addGraph(self)

    machine = TraversalMachine(self, result.state if result else None)

    async for result in machine:
      if result is None:
        return
      inputs = result.inputs
      descriptor = result.descriptor
      missingInputs = result.missingInputs

      if result.skip:
        if probe:
          probe.dispatchEvent(
            ProbeEvent("skip", descriptor.__dict__ | inputs | missingInputs)
          )
        continue

      if (descriptor.type == "input"):
        yield InputStageResult(result)
        if probe:
          probe.dispatchEvent(
            ProbeEvent("input", descriptor.__dict__ | inputs | {
              "outputs": await result.outputsPromise,
            })
          )
        continue

      if (descriptor.type == "output"):
        if probe:
          probe.dispatchEvent(ProbeEvent("output", descriptor.__dict__ | inputs))
        yield OutputStageResult(result)
        continue

      # The include and slot handlers require a reference to themselves to
      # create subgraph validators at the right location in the graph.
      if descriptor.type in ["include", "slot"]:
        inputs["parent"] = descriptor

      handler = handlers.get(descriptor.type)
      if not handler:
        raise Exception(f'No handler for node type "{descriptor.type}"')

      beforehandlerDetail = descriptor.__dict__ | inputs | {"outputs": {}}

      yield BeforeHandlerStageResult(result)

      shouldInvokeHandler = (
        not probe or
        probe.dispatchEvent(
          ProbeEvent("beforehandler", beforehandlerDetail)
        )
      )
      
      if type(handler) == javascript.proxy.Proxy:
        # This can possibly be wrapped in an AsyncTask instead of a trivial coroutine
        async def await_js(func, args):
          res = func(args)
          # Outputs can be a javascript proxy, so convert to dict
          try:
            res = {k: res[k] for k in res}
          except TypeError as e:
            # This can occur when javascript object is empty.
            res = {}
          return res
        outputsPromise = await_js(handler, inputs)
      else:
        outputsPromise = (
            handler(inputs) if shouldInvokeHandler else wrap_future(beforehandlerDetail.outputs)
        )

      # TODO(kevxiao): should append probe.dispatchEvent to part of promise/awaitable instead of running now
      if probe:
        probe.dispatchEvent(
          ProbeEvent("node", descriptor | inputs | outputsPromise | {
            "validatorMetadata": [validator.getValidatorMetadata(descriptor) for validator in self._validators]
          })
        )

      result.outputsPromise = outputsPromise

  def handlersFromBoard(
    self,
    probe: Optional[EventListener] = None,
    slots: Optional[BreadboardSlotSpec] = None,
  ) -> NodeHandlers:
    core = Core(
      self,
      self._slots | slots if slots else self._slots,
      self._validators,
      self._parent,
      probe,
    )
    kits = [core] + self.kits
    handlers = {}
    for kit in kits:
      kit_handlers = kit.handlers
      self.ctr.append(kit_handlers)

      # can't use union operator here because kit.handlers can be a javascript Proxy
      for k in kit_handlers:
        handlers[k] = kit_handlers[k]
        continue
    return handlers
import json
from typing import Self
from util import wrap_future
from traversal.result import MachineResult
from traversal.machine import TraversalMachine
from traversal.traversal_types import InputValues, NodeDescriptor, OutputValues, TraversalResult
from breadboard_types import BreadboardRunResult, RunResultType

class RunResult(BreadboardRunResult):
  _type: RunResultType
  _state: TraversalResult

  def __init__(self, state: TraversalResult, type: RunResultType):
    self._state = state
    self._type = type

  @property
  def type(self) -> RunResultType:
    return self._type

  @property
  def node(self) -> NodeDescriptor:
    return self._state.descriptor

  @property
  def inputArguments(self) -> InputValues:
    return self._state.inputs

  @BreadboardRunResult.inputs.setter
  def inputs(self, inputs: InputValues):
    self._state.outputsPromise = wrap_future(inputs)

  @property
  def outputs(self) -> OutputValues:
    return self._state.inputs

  @property
  def state(self) -> TraversalResult:
    return self._state

  async def save(self):
    return json.dumps(
      {
        "state": await TraversalMachine.prepareToSafe(self._state),
        "type": self._type,
      },
      replacer
    )

  def isAtExitNode(self) -> bool:
    return (
      len(self._state.newOpportunities) == 0 and
      len(self._state.opportunities) == 0 and
      len(self._state.pendingOutputs) == 0
    )

  @staticmethod
  def load(stringifiedResult: str) -> Self:
    res = json.loads(stringifiedResult, reviver)
    state = res.state
    type = res.type
    machineResult = MachineResult.fromObject(state)
    return RunResult(machineResult, type)

class InputStageResult(RunResult):
  def __init__(self, state: TraversalResult):
    super().__init__(state, "input")

  @property
  def outputs(self) -> OutputValues:
    raise Exception('Outputs are not available in the "input" stage')

class OutputStageResult(RunResult):
  def __init__(self, state: TraversalResult):
    super().__init__(state, "output")

  @RunResult.inputArguments.getter
  def inputArguments(self) -> InputValues:
    raise Exception('Input arguments are not available in the "output" stage')

  @RunResult.inputs.setter
  def inputs(self, inputs: InputValues):
    raise Exception('Setting inputs is not available in the "output" stage')
  

class BeforeHandlerStageResult(RunResult):
  def __init__(self, state: TraversalResult):
    super().__init__(state, "beforehandler")
    
  # gettter
  def inputArguments() -> InputValues:
    raise Exception(
      'Input arguments are not available in the "beforehandler" stage'
    )
  
  # setter
  def inputs(inputs: InputValues):
    raise Exception("Setting inputs is not available in the output stage")
from .traversal_types import (
  Edge,
  CompletedNodeOutput,
  TraversalResult,
  ErrorCapability,
  OutputValues,
)
from .representation import GraphRepresentation
from .result import MachineResult
from typing import Awaitable, List, Optional, Self
from .traversal import Traversal
import uuid
import asyncio


class TraversalMachineIterator():
  graph: GraphRepresentation
  _current: TraversalResult
  _noParallelExecution: bool

  def __init__(
    self,
    graph: GraphRepresentation,
    result: TraversalResult,
    noParallelExecution = True,
  ):
    self.graph = graph
    self._current = result
    self._noParallelExecution = noParallelExecution

  @staticmethod
  def _processCompletedNode(
    result: TraversalResult,
    completedNodeOutput: CompletedNodeOutput,
  ):
    promiseId = completedNodeOutput.promiseId
    outputs = completedNodeOutput.outputs
    newOpportunities = completedNodeOutput.newOpportunities
    result.pendingOutputs.pop(promiseId)

    # Process outputs.
    result.opportunities.extend(newOpportunities)
    result.state.wireOutputs(newOpportunities, outputs)

    if outputs.get("$error") and not any(e.out == "$error" for e in newOpportunities):
      # If the node threw an exception and it wasn't routed via $error,
      # throw it again. This will cause the traversal to stop.
      raise Exception(
        "Uncaught exception in node handler. " +
          "Catch by wiring up the $error output.",
        {
          "cause": outputs["$error"],
        }
      )

  @staticmethod
  async def processAllPendingNodes(
    result: TraversalResult
  ) -> TraversalResult:
    completed = await asyncio.gather(result.pendingOutputs.values())
    for completedNodeOutput in completed:
      TraversalMachineIterator._processCompletedNode(
        result,
        completedNodeOutput
      )

  def __aiter__(self):
    return self

  async def __anext__(self) -> TraversalResult:
    # If there are no missing inputs, let's consume the outputs
    if not self._current.skip:
      inputs = self._current.inputs
      outputsPromise = self._current.outputsPromise
      newOpportunities = self._current.newOpportunities
      descriptor = self._current.descriptor

      # Mark inputs as used, i.e. shift inputs queues.
      self._current.state.useInputs(descriptor.id, self._current.inputs)

      promiseId = uuid.uuid4()
      async def _promise():
        try:
          if outputsPromise and isinstance(outputsPromise, Awaitable):
            outputs = await outputsPromise
          else:
            outputs = outputsPromise if outputsPromise else {}
          
          # If not already present, add inputs and descriptor along for
          # context and to support retries.
          if "$error" in outputs:
            outputs["$error"] = outputs["$error"] | {
              "descriptor": descriptor,
              "inputs": inputs,
            }
          return CompletedNodeOutput(promiseId=promiseId, outputs=outputs, newOpportunities=newOpportunities)
        except Exception as e:
          # If the handler threw an exception, turn it into a $error output.
          # Pass the inputs and descriptor along for context and to support
          # retries. This Promise will hence always resolve.
          return CompletedNodeOutput(
            promiseId=promiseId,
            outputs={
              "$error": ErrorCapability(
                error=e,
                inputs=inputs,
                descriptor=descriptor
              ),
            },
            newOpportunities=[edge for edge in newOpportunities if edge.out == "$error"],
          )

      self._current.pendingOutputs[promiseId] = _promise()

    # If there are no more opportunites or we've disabled parallel execution,
    # let's wait for pending nodes to be done
    while (
      (not self._current.opportunities or self._noParallelExecution) and
      len(self._current.pendingOutputs) > 0
    ):
      # Wait for the first pending node to be done.
      done, pending = await asyncio.wait([asyncio.create_task(coroutine) for coroutine in self._current.pendingOutputs.values()], return_when=asyncio.FIRST_COMPLETED)

      TraversalMachineIterator._processCompletedNode(
        self._current,
        done.pop().result()
      )

    # If there are no more opportunities and none are pending, we're done.
    if not self._current.opportunities:
      raise StopAsyncIteration

    # Now, we're ready to start the next iteration.

    # Otherwise, let's pop the next opportunity from the queue.
    opportunity = self._current.opportunities.pop(0)

    heads = self.graph.heads
    nodes = self.graph.nodes
    tails = self.graph.tails

    toNode = opportunity.next
    currentDescriptor = nodes.get(toNode)
    if not currentDescriptor:
      raise Exception(f'No node found for id "{toNode}"')

    incomingEdges = heads.get(toNode, [])
    inputs = self._current.state.getAvailableInputs(toNode)

    missingInputs = Traversal.computeMissingInputs(
      incomingEdges,
      inputs,
      currentDescriptor
    )

    newOpportunities = tails.get(toNode, [])
    # Pour configuration values into inputs. These are effectively like
    # constants.
    if currentDescriptor.configuration:
      inputsWithConfiguration = currentDescriptor.configuration
    else:
      inputsWithConfiguration = {}
    inputsWithConfiguration = inputsWithConfiguration | inputs

    self._current = MachineResult(
      currentDescriptor,
      inputsWithConfiguration,
      missingInputs,
      self._current.opportunities,
      newOpportunities,
      self._current.state,
      self._current.pendingOutputs
    )
    return self._current
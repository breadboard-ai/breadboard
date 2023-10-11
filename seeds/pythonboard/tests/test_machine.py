import unittest
import asyncio
import sys
sys.path.append("..")
from src import util
from src.traversal.state import MachineEdgeState
from src.traversal.traversal_types import (
  ErrorCapability,
  GraphDescriptor,
  InputValues,
  OutputValues,
  KitDescriptor,
  Edge,
  NodeDescriptor,
)
from src.traversal.result import MachineResult
from src.traversal.machine import TraversalMachine
import json
from typing import List, Optional
import glob
import os
import aiofiles
from dataclasses import dataclass
from dataclasses_json import dataclass_json

IN_DIR = os.path.dirname(__file__) + "/../../graph-runner/tests/data/"


@dataclass_json
@dataclass
class TestGraphDescriptor(GraphDescriptor):
  sequence: List[str]
  inputs: InputValues
  outputs: List[OutputValues]

  throws: bool = False

class TestMachine(unittest.IsolatedAsyncioTestCase):
  async def _run_file(self, filename):
    async with aiofiles.open(filename, 'r') as handle:
      # read the contents of the file
      data = await handle.read()
      data = data.replace('"from":', '"previous":')
      data = data.replace('"to":', '"next":')
      data = data.replace('"in":', '"input":')
      graph = TestGraphDescriptor.from_json(data)
      if "skip" in graph.__dict__.get("title", []):
        self.log("Skipped")
        return
      machine = TraversalMachine(graph)
      outputs = []
      sequence = []
      async def run():
        async for result in machine:
          if result is None or result.skip:
            continue
          inputs = result.inputs
          descriptor = result.descriptor
          sequence.append(descriptor.id)
          if descriptor.type == "input":
            result.outputsPromise = util.wrap_future(graph.inputs)
          elif descriptor.type == "output":
            outputs.append(dict(inputs))
          elif descriptor.type == "extract":
            inputsList : List[str] = result.inputs['list']
            text = inputsList.pop(0)
            future = asyncio.Future()
            if len(inputsList):
              future.set_result({'list': inputsList, 'text': text})
            else:
              future.set_result({'text': text})
            result.outputsPromise = future
          elif descriptor.type == "error":
            result.outputsPromise = util.wrap_future({"$error": ErrorCapability(kind="error", error=Exception("Test error"))})
          elif descriptor.type == "throw":
            result.outputsPromise = util.wrap_future(Exception("Test throw"))
          elif descriptor.type == "noop":
            result.outputsPromise = util.wrap_future(dict(inputs))
          else:
            raise Exception(f"Unknown node: {descriptor.id}")

      if graph.throws:
        with self.assertRaises(Exception):
          await run()
      else:
        await run()

      # Rewrite instancesof Error to strings for comparison.
      for output in outputs:
        if output.get("$error"):
          error = output.get("$error")
          if error.error:
            self.assertTrue(isinstance(error.error, Exception))
            output["$error"].error = "instanceof Error"
          if error.descriptor:
            output["$error"].descriptor = error.descriptor.to_dict()
          output["$error"] = output["$error"].to_dict()

      #expected_outputs = [output | {"$error": output["$error"].to_dict()} for output in graph.outputs]

      self.assertEqual(outputs, graph.outputs)
      self.assertEqual(sequence, graph.sequence)

  async def test_graphs(self):
    files = glob.glob(IN_DIR + "*.json")
    if not files:
      self.fail(f"Unable to find any test files in {IN_DIR}")

    for filename in files:
      await self._run_file(filename)

  async def test_interrupt_resume(self):
    async with aiofiles.open(IN_DIR + "one-entry.json", 'r') as handle:
      # read the contents of the file
      data = await handle.read()
    data = data.replace('"from":', '"previous":')
    data = data.replace('"to":', '"next":')
    data = data.replace('"in":', '"input":')
    graph = TestGraphDescriptor.from_json(data)

    iteration_count = 0
    async for result in TraversalMachine(graph):
      iteration_count += 1
      if iteration_count == 1:
        self.assertFalse(result.skip)
        self.assertEqual(result.descriptor.id, "node-a")
        self.assertEqual(result.descriptor.type, "input")
        result.outputsPromise = util.wrap_future(graph.inputs)
      elif iteration_count == 2:
        self.assertTrue(result.skip)
      elif iteration_count == 3:
        self.assertFalse(result.skip)
        self.assertEqual(result.descriptor.id, "node-b")
        self.assertEqual(result.descriptor.type, "noop")
        result.outputsPromise = util.wrap_future(result.inputs)
      elif iteration_count == 4:
        self.assertEqual(result.descriptor.id, "node-c")
        self.assertEqual(result.descriptor.type, "output")
        self.assertEqual(result.inputs, graph.outputs[0])
        break

if __name__ == "__main__":
    unittest.main()
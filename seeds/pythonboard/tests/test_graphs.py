import unittest
import sys
import os
project_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(project_path)
from src.traversal.state import MachineEdgeState
from src.traversal.traversal_types import Edge
from src.main import main
from src.breadboard import Board
from src import breadboard
from unittest import mock

class TestKit():
  output = "hello!"
  index = 0
  @staticmethod
  async def generateText(_inputs):
    if type(TestKit.output) == list:
      output = TestKit.output[index]
      index = max(index + 1, len(TestKit.output) - 1)
    else:
      output = TestKit.output
    return {"completion": output}
  
  @staticmethod
  async def secrets(_inputs):
    return {k: f"test_k" for k in _inputs["keys"]}
      
  def __init__(self, _arg):
    self.handlers = {}
    self.handlers["generateText"] = TestKit.generateText
    self.handlers["secrets"] = TestKit.secrets

class TestGraphs(unittest.IsolatedAsyncioTestCase):

  @mock.patch('src.main.print', create=True)
  @mock.patch('src.main.input', create=True)
  @mock.patch('src.main.Board.fromGraphDescriptor')
  async def test_accumulating_context(self, mock_ctr, mock_input, mock_print):
    mock_input.side_effect = ["First input", "Second input", ""]
    mock_print.side_effect = print
    original_fun = Board.fromGraphDescriptor
    
    async def fromGraphDescriptor(graph):
      res = await original_fun(graph)
      res.addKit(TestKit)
      return res
    mock_ctr.side_effect = fromGraphDescriptor
    await main("seeds/graph-playground/graphs/accumulating-context.json")
    # verify that multiple rounds were called.
    # Verify that output is correct.
    expected_calls = [
      mock.call("Let's traverse a graph!"),
      mock.call("hello!"),
      mock.call("hello!"),
      mock.call("Awesome work! Let's do this again sometime."),
    ]
    mock_print.assert_has_calls(expected_calls, any_order=False)

  @mock.patch('src.main.print', create=True)
  @mock.patch('src.main.input', create=True)
  @mock.patch('src.main.Board.fromGraphDescriptor')
  async def test_math(self, mock_ctr, mock_input, mock_print):
    mock_input.side_effect = ["What's one plus seven?"]
    mock_print.side_effect = print
    original_fun = Board.fromGraphDescriptor
    async def fromGraphDescriptor(graph):
      res = await original_fun(graph)
      res.addKit(TestKit)
      return res
    TestKit.output = "```js\nfunction compute() {\nreturn 1 + 7;\n}\n```"
    mock_ctr.side_effect = fromGraphDescriptor
    await main("seeds/graph-playground/graphs/math.json")
    expected_calls = [
      mock.call("Let's traverse a graph!"),
      mock.call("8"),
      mock.call("Awesome work! Let's do this again sometime."),
    ]
    mock_print.assert_has_calls(expected_calls, any_order=False)


if __name__ == '__main__':
    unittest.main()

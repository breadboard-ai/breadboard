import unittest
import sys
import os
project_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(project_path)
from src.traversal.state import MachineEdgeState
from src.traversal.traversal_types import Edge

class TestBreadboard(unittest.TestCase):
  def test_state(self):
    state = MachineEdgeState()
    state.wireOutputs(
      [
        Edge("a", "b", out="foo", input="foo"),
        Edge("a", "b", out="bar", input="baz"),
        Edge("a", "c", out="bar", input="bar", constant=True),
        Edge("a", "d", out="*"),
      ], # opportunities
      {
        "foo": 1,
        "bar": 2,
      } # outputs
    )

    # Now let's queue up more data
    state.wireOutputs(
      [Edge(previous="a", next="b", out="foo", input="foo")], # opportunities
      {
        "foo": 3,
      } # outputs
    )

    # Verify that inputs are were wired correctly.
    self.assertEqual(state.getAvailableInputs("a"), {})
    self.assertEqual(state.getAvailableInputs("b"), { "foo": 1, "baz": 2 })
    self.assertEqual(state.getAvailableInputs("c"), { "bar": 2 })
    self.assertEqual(state.getAvailableInputs("d"), { "foo": 1, "bar": 2 })

    # Verify that the queues are emptied correctly.
    state.useInputs("b", { "foo": 1, "baz": 2 })
    self.assertEqual(state.getAvailableInputs("b"), { "foo": 3 })

    # Verify that constants remain.
    state.useInputs("c", { "bar": 2 })
    self.assertEqual(state.getAvailableInputs("c"), { "bar": 2 })

    # Verify that using only inputs leaves the other queues as is.
    state.useInputs("d", { "foo": 1 })
    self.assertEqual(state.getAvailableInputs("d"), { "bar": 2 })


if __name__ == '__main__':
    unittest.main()
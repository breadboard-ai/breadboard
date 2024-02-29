
from breadboard_python.main import Board, Field, SchemaObject
from breadboard_python.import_node import require
import json
from typing import Optional, Union, Callable, List

Core = require("@google-labs/core-kit")
Templates = require("@google-labs/template-kit")



class InputSchema(SchemaObject):
  pass

class OutputSchema(SchemaObject):
  pass

class TrivialTool(Board[InputSchema, OutputSchema]):
  title = "Trivial tool"
  description = 'Does nothing, but it shoudl be called to test integration.'
  version = "0.0.2"

  type = "trivial_tool"

  def describe(self, input, output):
    pass

if __name__ == "__main__":
  import sys
  a = TrivialTool()
  with open(sys.argv[1], "w") as f:
    json.dump(a, f, indent=2)
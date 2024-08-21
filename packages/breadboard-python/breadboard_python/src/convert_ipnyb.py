import sys
import json
from breadboard_python.main import Board, Field, SchemaObject
from breadboard_python.import_node import require
from breadboard_python.adhoc import breadboard_node
import json
from typing import Optional, Union, Callable, List


def create_python_board(code: str):
  class RunPythonBoard(Board):
    title = "Run Python"
    type = "runPython"
    description = "Runs python code."
    _is_node = True
    _source_code = code
    _pickled_code = None
    #_python_version = '.'.join(str(x) for x in sys.version_info[:3])
    _python_version = "3"
    def describe(self, input, output):
      pass
      
    def get_configuration(self):
      config = super().get_configuration()
      if "code" in config:
        raise Exception("Code is already populated.")
      config["code"] = self._source_code
      config["pickle"] = self._pickled_code
      config["python_version"] = self._python_version
      return config

  return RunPythonBoard

filename = "packages/breadboard-python/src/breadboard_python/testing-api.ipnyb"
with open(filename, 'r') as f:
  notebook = json.load(f)

nodes = []
for cell in notebook["cells"]:
  source = "".join(cell["source"])
  nodes.append(create_python_board(source))

class TestPythonBoard(Board):
  title = "Test Python Board on runtime"
  description = "Some simple board that's written in Python and runs on an IPython runtime."
  def describe(self, input, output):
    prev = input
    for node in nodes:
      prev = node(prev)
    output(prev)

if __name__ == "__main__":
  a = TestPythonBoard()
  with open(sys.argv[1], "w") as f:
    json.dump(a, f, indent=2)
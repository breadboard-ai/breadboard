from breadboard_python.main import Board, SchemaObject, Field
import dis
import sys
from contextlib import contextmanager
from typing import Any
import builtins as builtin
import json
import cloudpickle
import base64
import sys

def get_function_calls(func, built_ins=False):
  # the used instructions
  ins = list(dis.get_instructions(func))[::-1]

  # dict for function names (so they are unique)
  names = {}

  # go through call stack
  for i, inst in list(enumerate(ins))[::-1]:
    # find last CALL_FUNCTION

    print(inst)
    if inst.opname == "CALL" or inst.opname == "CALL_FUNCTION_EX":

      # function takes ins[i].arg number of arguments
      ep = i + inst.arg + 1 + (2 if inst.opname[13:16] == "_KW" else 1)

      # LOAD that loaded this function
      entry = ins[ep]
      print(f"KEX: {entry}")

      # ignore list comprehensions / ...
      name = str(entry.argval)
      if "." not in name and entry.opname == "LOAD_GLOBAL" and (built_ins or not hasattr(builtin, name)):
        # save name of this function
        names[name] = True

      # reduce this CALL_FUNCTION and all its paramters to one entry
      ins = ins[:i] + [entry] + ins[ep + 1:]

  return sorted(list(names.keys()))

import inspect
ALL_HANDLERS = {}
def breadboard_node(func):
  print(get_function_calls(func))
  print(inspect.signature(func).parameters)
  print(inspect.signature(func).return_annotation)
  #code = inspect.getsource(func)
  code = cloudpickle.dumps(func)
  code = base64.b64encode(code).decode('ascii')
  print(code)

  # get the input/output schema of the function. set it to a master registry.
  # replace all function calls with decorated ones.
  class FuncBoard(Board):
    title = "func.get_name()"
    type = "runPython"
    description = "func.get_docstring()"
    _source_code = code
    _python_version = '.'.join(str(x) for x in sys.version_info[:3])
    def describe(self, input, output):
      pass
      
    def get_configuration(self):
      config = super().get_configuration()
      if "code" in config:
        raise Exception("Code is already populated.")
      config["code"] = self._source_code
      config["python_version"] = self._python_version
      return config

  return FuncBoard

def child_function1():
  return 3


def child_function2(key: str):
  return 3



@breadboard_node
def master_function(key: str, value: Any) -> int:
  output = 0
  if value:
    output += child_function1()
  output += child_function2(key=key)
  output += child_function2(key)
  blar = {"key": key}
  output += child_function2(**blar)
  return {"output": output}

class InputSchema(SchemaObject):
  field1: str = Field("blaster")

class OutputSchema(SchemaObject):
  output: str = Field(description="All input smashed together.")

class TestBoard(Board[InputSchema, OutputSchema]):
  title = "Testing Python adhoc boards"
  description = "Trying out making a board that uses a decorator."
  def describe(self, input, output):
    self.node = master_function(key="key11", value=input.field1)
    output(self.node)



if __name__ == "__main__":
  import sys
  a = TestBoard()
  with open(sys.argv[1], "w") as f:
    json.dump(a, f, indent=2)
from .main import Board
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
  pickled_code = cloudpickle.dumps(func)
  pickled_code = base64.b64encode(pickled_code).decode('ascii')
  print(pickled_code)

  # get the input/output schema of the function. set it to a master registry.
  # replace all function calls with decorated ones.
  class FuncBoard(Board):
    title = "func.get_name()"
    type = "runPython"
    description = "func.get_docstring()"
    _is_node = True
    _source_code = None
    _pickled_code = pickled_code
    _python_version = '.'.join(str(x) for x in sys.version_info[:3])
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
  output += child_function2(**key)
  return output

class TestBoard(Board):
  def describe(self, input, output):
    self.node = master_function(key="key1", value=input.field1)
    output(self.node)


#print(get_function_calls(master_function))
#a = TestBoard()
#print(json.dumps(a, indent=2))
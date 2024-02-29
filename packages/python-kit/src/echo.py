from typing import Callable, Dict

class Handler():
  # Return type should be {"inputSchema": JSON, "outputSchema": JSON}
  describe: Callable
  invoke: Callable

def echo_python():
  return "echoo!!"

def empty():
  return {"inputSchema": {}, "outputSchema": {}}
a = Handler()
a.invoke = echo_python
a.describe = empty
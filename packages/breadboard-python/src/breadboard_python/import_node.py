from .main import AttrDict, Board, convert_from_json_to_pydantic
#from javascript import require as require_js, eval_js

#from javascript import init
import javascript
import json
import time
import os

import importlib

def restart_javascript_module():
  javascript.config.event_loop.stop()
  importlib.reload(javascript.events)
  importlib.reload(javascript)

def require(package_name):
  try:
    kit_package = javascript.require(package_name)
  except javascript.errors.JavaScriptError:
    # Sometimes, the javascript module's JS subprocess does not load an npm package properly.
    # When restarted, it will load correctly.
    restart_javascript_module()
    kit_package = javascript.require(package_name)
    
  a = kit_package()
  handlers = a.handlers

  output = AttrDict()
  for handler_name in handlers:
    if handlers[handler_name].describe is None:
      input_schema = {}
      output_schema = {}
    else:
      b = handlers[handler_name].describe()
      res = javascript.eval_js('''JSON.stringify(await b)''')
      schema = json.loads(res)
      input_schema = schema["inputSchema"]
      output_schema = schema["outputSchema"]
      input_schema, input_field = convert_from_json_to_pydantic("Input" + handler_name, input_schema)
      output_schema, output_field = convert_from_json_to_pydantic("Output" + handler_name, output_schema)

    class ImportedClass(Board[input_schema, output_schema]):
      type = handler_name
      title = f"Auto-imported {handler_name}"
      description = f"This board is auto-imported from {package_name}"
      version = "0.?"
      def describe(self, input):
        self.output = AttrDict(output_schema)
        return self.output
      def get_configuration(self):
        config = super().get_configuration()
        if "schema" in config:
          config.pop("schema")
        return config
      
      __package_name = package_name
      
      """
      def __getattr__(self, name):
        if name == "__package_name":
          return super(Board, self).__getattr__(name)
        return super().__getattr__(name)
      """

    output[handler_name] = ImportedClass
  return output

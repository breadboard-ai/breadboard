from .main import AttrDict, Board, convert_from_json_to_pydantic

import javascript
import json

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

    input_schema = {}
    output_schema = {}
    if handlers[handler_name].describe is None:
      pass
    else:
      b = handlers[handler_name].describe()
      res = javascript.eval_js('''JSON.stringify(await b)''')
      schema = json.loads(res)
      input_schema = schema["inputSchema"]
      output_schema = schema["outputSchema"]
      if handler_name == "invoke":
        pass
      input_schema, input_field = convert_from_json_to_pydantic("Input" + handler_name, input_schema)
      converted_output_schema, output_field = convert_from_json_to_pydantic("Output" + handler_name, output_schema)

    class ImportedClass(Board[input_schema, converted_output_schema]):
      type = handler_name
      title = f"Auto-imported {handler_name}"
      description = f"This board is auto-imported from {package_name}"
      version = "0.?"
      # Need to convert SchemaOutput into something that has context.
      output = AttrDict(converted_output_schema)
      output_schema1 = converted_output_schema
      def __init__(self, **kwargs):
        super().__init__(**kwargs)

        if hasattr(self.output_schema1, "additionalProperties") and self.output_schema1.additionalProperties:
          self.output["*"] = self
      def describe(self, input, output):
        pass
      def get_configuration(self):
        config = super().get_configuration()
        if "schema" in config:
          config.pop("schema")
        return config
      
      _package_name = package_name
    

    output[handler_name] = ImportedClass
  return output

from main import AttrDict, Board
from javascript import require
import javascript
import json



class ImportedBoard(Board):
  def __init__(self, name, schema):
    self.type = name
    self.input_schema = schema["inputSchema"]
    self.output_schema = schema["outputSchema"]

def import_breadboard_js(package_name):
  #kit_package = require(package_name)
  kit_package = require("../../llm-starter/dist/src/index.js")
  a = kit_package()
  handlers = a.handlers

  output = AttrDict()
  for handler_name in handlers:
    b = handlers[handler_name].describe()
    res = javascript.eval_js('''JSON.stringify(await b)''')
    schema = json.loads(res)
    input_schema = schema["inputSchema"]
    output_schema = schema["outputSchema"]
    print(schema)
    print(f"KEX: received a handler: {handler_name}")

    # TODO: Convert input_schema and output_schema from dicts into actual schemas.
    class ImportedClass(Board[input_schema, output_schema]):
      type = handler_name
      title = f"Auto-imported {handler_name}"
      description = f"This board is auto-imported from {package_name}"
      version = "0.?"
      def describe(self):
        self.output = AttrDict(output_schema)
        return self.output
    
    output[handler_name] = ImportedClass
  print(output)
  return output

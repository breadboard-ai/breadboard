
from main import Board, Field, SchemaObject, List, AttrDict
import json
from typing import Optional, Union



class InputSchema(SchemaObject):
  text: str = Field(title="Echo", description="What shall I say back to you?", examples=[], required=True)

class OutputSchema(SchemaObject):
  text: str = Field(title="Answer", description="The answer to the math problem")

class Echo(Board[InputSchema, OutputSchema]):
  title = "Echo"
  description = "Echo cho cho cho ho o"
  version = "0.0.2"

  def describe(self, input):
    self.output = AttrDict()
    self.output.text = input.text
    return self.output

a = Echo()
print(json.dumps(a, indent=2))
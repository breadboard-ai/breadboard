from breadboard_python.main import Board, Field, SchemaObject, List, AttrDict
import json
from typing import Optional, Union

from breadboard_python.import_node import require
Core = require("@google-labs/core-kit")
Templates = require("@google-labs/template-kit")


class InputSchema(SchemaObject):
  question: str = Field(title="Math problem", description="Ask a math question", examples=["What is the square root of pi?"], required=True)
  generator: str = Field("/graphs/text-generator.json", title="Generator", description="The URL of the generator to call")

class OutputSchema(SchemaObject):
  result: str = Field(title="Answer", description="The answer to the math problem")

class Math(Board[InputSchema, OutputSchema]):
  title = "The Calculator Recipe"
  description = "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems."
  version = "0.0.2"

  def describe(self, input):
    self.template = Templates.promptTemplate(
      id="math-function",
      question=input.question,
      template="""Translate the math problem below into a self-contained,
zero-argument JavaScript function named \`compute\` that can be executed
to provide the answer to the problem. 

Do not use any dependencies or libraries.

Math Problem: {{question}}

Solution:""",
    )
    self.generator = Core.invoke(
      id="generator",
      path=input.generator,
      text=self.template.prompt
    )

    self.compute = Core.runJavascript(
      name="compute",
      code=self.generator.text,
    )
    self.output = AttrDict(**{"*": self.compute})
    return self.output

a = Math()
print(json.dumps(a, indent=2))
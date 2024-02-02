from breadboard_python.main import Board, Field, SchemaObject, List, AttrDict
import json
from breadboard_python.import_node import require
Core = require("@google-labs/core-kit")
Templates = require("@google-labs/template-kit")


class InputSchema(SchemaObject):
  question: str = Field(title="Math problem", description="Ask a math question", examples=["What is the square root of pi?"], required=True)
  generator: str = Field("/graphs/text-generator.json", title="Generator", description="The URL of the generator to call")

class OutputSchema(SchemaObject):
  result: str = Field(title="Answer", description="The answer to the math problem")

class Math(Board[InputSchema, OutputSchema]):
  title = "The Python Calculator Recipe"
  description = "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems. Defined in Python."
  version = "0.0.3"

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
    self.output = AttrDict()
    self.output.result = self.compute.result
    return self.output

if __name__ == "__main__":
  import sys
  a = Math()
  with open(sys.argv[1], "w") as f:
    json.dump(a, f, indent=2)

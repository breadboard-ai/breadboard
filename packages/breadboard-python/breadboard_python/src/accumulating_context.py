
from breadboard_python.main import Board, Field, SchemaObject
from breadboard_python.import_node import require
import json
from typing import Optional, Union

Core = require("@google-labs/core-kit")
Templates = require("@google-labs/template-kit")

class InputSchema(SchemaObject):
  text: str = Field(description="User: type here to chat with the assistant")
  generator: str = Field("text-generator.json", description="Generator: Text generator to use")

class OutputSchema(SchemaObject):
  text: str = Field(title="Assistant", description="Assistant: Assistant's response in the conversation with the user", required=True)


class AccumulatingContext(Board[InputSchema, OutputSchema]):
  title = "Accumulating Context (Python)"
  description = 'An example of a board that implements a multi-turn experience: a very simple chat bot that accumulates context of the conversations. Tell it "I am hungry" or something like this and then give simple replies, like "bbq". It should be able to infer what you\'re asking for based on the conversation context. All replies are pure hallucinations, but should give you a sense of how a Breadboard API endpoint for a board with cycles looks like.'
  version = "0.0.2"

  type = "accumulating-context"

  def describe(self, input, output):
    self.prompt = Templates.promptTemplate(
      id="assistant",
      template="This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
      context="",
    )
    self.conversationMemory = Core.append(
      accumulator="\n== Conversation History",
    )

    self.prompt(question=input.text)
    self.conversationMemory(user=input.text)
    self.conversationMemory(accumulator=self.conversationMemory.accumulator)
    self.prompt(context=self.conversationMemory.accumulator)
    generator = Core.invoke(id="generator", path=input.generator, text=self.prompt.prompt)
    self.conversationMemory(assistant=generator.text)
    output(text=generator.text)
    input(output)

if __name__ == "__main__":
  import sys
  a = AccumulatingContext()
  with open(sys.argv[1], "w") as f:
    json.dump(a, f, indent=2)

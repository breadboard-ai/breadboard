
from .main import Board, Field, SchemaObject, List, AttrDict
import json
from typing import Optional, Union

from import_node import require
Core = require("@google-labs/core-kit")
Templates = require("@google-labs/template-kit")

class UserRequest(SchemaObject):
  text: str = Field(description="User: type here to chat with the assistant")

class ParametersSchema(SchemaObject):
  generator: str = Field("text-generator.json", description="Generator: Text generator to use")

class InputSchema(SchemaObject):
  parameters: ParametersSchema
  userRequest: UserRequest

class OutputSchema(SchemaObject):
  text: str = Field(title="Assistant", description="Assistant: Assistant's response in the conversation with the user", required=True)


class AccumulatingContext(Board[InputSchema, OutputSchema]):
  title = "Accumulating Context (Python)"
  description = 'An example of a board that implements a multi-turn experience: a very simple chat bot that accumulates context of the conversations. Tell it "I am hungry" or something like this and then give simple replies, like "bbq". It should be able to infer what you\'re asking for based on the conversation context. All replies are pure hallucinations, but should give you a sense of how a Breadboard API endpoint for a board with cycles looks like.'
  version = "0.0.1"

  type = "accumulating-context"

  def describe(self, input):
    self.prompt = Templates.promptTemplate(
      id="assistant",
      template="This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
      context="",
    )
    self.conversationMemory = Core.append(
      accumulator="\n== Conversation History",
    )

    self.prompt(question=input.userRequest.text)
    self.conversationMemory(user=input.userRequest.text)
    self.conversationMemory(accumulator=self.conversationMemory.accumulator)
    # TODO: Handle self-referencing edges.
    self.prompt(context=self.conversationMemory.accumulator)
    generator = Core.invoke(id="generator", path=input.parameters.generator, text=self.prompt.prompt)
    self.conversationMemory(assistant=generator.text)
    self.output = AttrDict(text=generator.text)
    return self.output

if __name__ == "__main__":
  import sys
  a = AccumulatingContext()
  print(json.dumps(a, indent=2))

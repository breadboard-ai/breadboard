
from breadboard_python.main import Board, Field, SchemaObject
from breadboard_python.import_node import require
from breadboard_python.adhoc import breadboard_node
import json
from typing import Optional, Union, Callable, List

Core = require("@google-labs/core-kit")
Templates = require("@google-labs/template-kit")


class Tool(SchemaObject):
  name: str
  boardPath: str

class BoardCallerInput(SchemaObject):
  text: str
  context: str
  tools: List[Tool]

class BoardCallerOutput(SchemaObject):
  text: str
  context: str

class BoardCaller(Board[BoardCallerInput, BoardCallerOutput]):
  type = "board-caller"
  def describe(self, input, output):
    self.caller = Core.invoke(path=input.tools)
    output(self.caller)



class FunctionCallInput(SchemaObject):
  text: str
  context: str
  tools: List[Tool]

class FunctionCallOutput(SchemaObject):
  text: str
  context: str

class HandleFunctionCall(Board[FunctionCallInput, FunctionCallOutput]):
  type = "function-call"
  def describe(self, input, output):
    #self.boardCaller = BoardCaller(input)
    self.caller = Core.invoke(path="board-caller.json", text=input.text, context=input.context, tools=input.tools)
    output(input)


class ChatBotInput(SchemaObject):
  text: str
  post_process: Optional[str]
  prompt: str

class ChatBotOutput(SchemaObject):
  pass

class ChatBot(Board[ChatBotInput, ChatBotOutput]):
  type = "chat-bot"
  def describe(self, input, output):
    self.prompt = Templates.promptTemplate(
      template="This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
      context="",
    )
    self.conversationMemory = Core.append(
      accumulator="\n== Conversation History",
    )
    
    #self.post_process = Core.invoke(path=input.post_process)

    self.prompt(question=input.prompt)
    self.conversationMemory(user=input.text)
    self.conversationMemory(accumulator=self.conversationMemory.accumulator)
    self.prompt(context=self.conversationMemory.accumulator)
    self.board_caller = BoardCaller(text=self.prompt.prompt, tools=input.tools)
    #self.post_process(input.post_process)
    #generator = Core.invoke(id="generator", path=input.generator, text=self.prompt.prompt)
    
    #self.conversationMemory(assistant=self.board_caller.text)
    output(text=self.prompt.text)
    input(output)




class ToolCallInput(SchemaObject):
  tools: List[Tool] = Field()
  prompt: str = Field()

class ToolCallOutput(SchemaObject):
  text: str = Field(title="Assistant", description="Assistant: Assistant's response in the conversation with the user", required=True)

class ToolCallBot(Board[ToolCallInput, ToolCallOutput]):
  title = "ToolCallBot"
  description = "A template for a chatbot with tool-calling capabilities."
  type = "tool-call"
  version = "0.0.1"

  def describe(self, input, output):
    #self.handle_function_calls = HandleFunctionCall(tools=input.tools)
    # self.handle_function_calls should be passed in as a board.
    self.chatLoop = ChatBot(prompt=input.prompt, tools=input.tools)
    output(self.chatLoop)

class TrivialTool(Board):
  title = "Trivial tool"
  description = 'Does nothing, for testing purposes'
  version = "0.0.1"

  type = "trivial_tool"

  def describe(self, input, output):
    output(input)

import requests

@breadboard_node
def ping_server(backend_url: str) -> int:
  try:
    response = requests.get(backend_url, timeout=1)
    return response.status_code
  except requests.ConnectionError:
    return 503

class InputSchema(SchemaObject):
  backend_url: str = Field(description="Which backend url to send orders to")

class OutputSchema(SchemaObject):
  text: str = Field(title="Assistant", description="Assistant: Assistant's response in the conversation with the user", required=True)

class CoffeeBot(Board[InputSchema, OutputSchema]):
  title = "CoffeBeBot (Python)"
  description = 'A recreation of Coffeebot, which is a chatbot that takes in coffee orders and then sends them to a backend.'
  version = "0.0.2"

  type = "coffeebot"

  def describe(self, input, output):
    tools: List[Tool] = [
      ping_server(backend_url=input.backend_url)
    ]
    prompt = """HI."""
    self.tool_calling_loop = ToolCallBot(tools=tools, prompt=prompt, backend_url=input.backend_url)
    output(self.tool_calling_loop)

if __name__ == "__main__":
  import sys
  a = CoffeeBot()
  with open(sys.argv[1], "w") as f:
    json.dump(a, f, indent=2)
from main import Board, Field, SchemaObject, List, AttrDict
import json
from typing import Optional, Union

from import_node import require
Starter = require("@google-labs/llm-starter")
Nursery = require("@google-labs/node-nursery-web")

class TransformOutput(AttrDict):
  stream: SchemaObject = Field(description="Mocked stream field")
class ChunkTransformerOutput(SchemaObject):
  chunk: str = Field(description="The result of the Jsonata expression", title="result", required=True)
class ChunkTransformerInput(SchemaObject):
  chunk: Union[str, SchemaObject] = Field(description="The JSON object to evaluate", title="json", required=True)
  
class Nursery_transformStream(Board):
  type = "transformStream"
  def describe(self, input):
    # TODO: Why doesn't this ever run? Load needs to happen in initializer.
    raise Exception("YOoo")
  
    self.output = TransformOutput()
    return self.output

class ChunkTransformer(Board[ChunkTransformerInput ,ChunkTransformerOutput]):
  title = None
  description = None
  version = None
  type = "board"
  def describe(self, input):
    transformCompletion = Starter.jsonata(
      id="transformCompletion",
      expression='choices[0].delta.content ? choices[0].delta.content : ""',
      json=input.chunk
    )
    self.output = AttrDict()
    self.output.chunk = transformCompletion.result
    return self.output


toolsExample = [
  {
    "name": "The_Calculator_Recipe",
    "description":
      "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",
    "parameters": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "Ask a math question",
        },
      },
      "required": ["text"],
    },
  },
  {
    "name": "The_Search_Summarizer_Recipe",
    "description":
      "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",
    "parameters": {
      "type": "object",
      "properties": {
        "text": {
          "type": "string",
          "description": "What would you like to search for?",
        },
      },
      "required": ["text"],
    },
  },
]
contextExample = [
  {
    "role": "system",
    "content": "You are a pirate. Please talk like a pirate.",
  },
]

FORMAT_PARAMETERS_EXPRESSION = """(
        $context := $append(
            context ? context, [
                {
                    "role": "user",
                    "content": text
                }
            ]);
        OPENAI_API_KEY ? text ? {
            "headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer " & OPENAI_API_KEY
            },
            "body": {
                "model": "gpt-3.5-turbo-1106",
                "messages": $context,
                "stream": useStreaming,
                "temperature": 1,
                "top_p": 1,
                "tools": tools ? [tools.{ "type": "function", "function": $ }],
                "frequency_penalty": 0,
                "presence_penalty": 0
            },
            "stream": useStreaming,
            "context": $context
        } : {
            "$error": "`text` input is required"
        } : {
            "$error": "`OPENAI_API_KEY` input is required"
        }
      )"""

class InputSchema(SchemaObject):
  text: str = Field(
    description="The text to generate",
    examples=["What is the correct term for the paddle in cricket?"],
    required=True,
  )

  tools: List[str] = Field(
    '[]',
    description="An array of functions to use for tool-calling",
    examples=[json.dumps(toolsExample, indent=2)],
  )

  context: List[SchemaObject] = Field(
    '[]',
    title="Context",
    description="An array of messages to use as conversation context",
    examples= [json.dumps(contextExample, indent=2)],
  )

  useStreaming: bool = Field(
    'false',
    title="Stream",
    description="Whether to stream the output",
  )

class TextOutputSchema(SchemaObject):
  text: str = Field(title="Text", description="The generated text")
  context: List[str] = Field(title="Context", description="The conversation context")

class ToolOutputSchema(SchemaObject):
  toolCalls: SchemaObject = Field(title="Tool Calls", description="The generated tool calls")
  context: List[str] = Field(title="Context", description="The conversation context")

class StreamOutputSchema(SchemaObject):
  stream: SchemaObject = Field(title="Stream", format="stream", description="The generated text", type="object")

class OutputSchema(SchemaObject):
  textOutput: TextOutputSchema
  toolCallsOutput: ToolOutputSchema
  streamOutput: StreamOutputSchema

class OpenAiGpt_3_5_Turbo(Board[InputSchema, OutputSchema]):
  # Metadata
  title = "OpenAI GPT-3.5-turbo"
  description = "This board is the simplest possible invocation of OpenAI's GPT-3.5 API to generate text."
  version = "0.0.2"

  def __init__(self) -> None:
    super().__init__()
    self.formatParameters = Starter.jsonata(
      id="formatParameters",
      expression=FORMAT_PARAMETERS_EXPRESSION,
      raw=True,
      OPENAI_API_KEY=Starter.secrets(keys=["OPENAI_API_KEY"]),
    )
    self.fetch = Starter.fetch(
      id="callOpenAI",
      url="https://api.openai.com/v1/chat/completions",
      method="POST",
    )
    self.getResponse = Starter.jsonata(
      id="getResponse",
      expression="""choices[0].message.{
      "text": $boolean(content) ? content,
      "tool_calls": tool_calls.function ~> | $ | { "args": $eval(arguments) }, "arguments" |
    }""",
      raw=True,
      #json=UNFILLED,
    )
    self.getNewContext = Starter.jsonata(
      id="getNewContext",
      expression="$append(messages, response.choices[0].message)",
      #messages=UNFILLED
    )

  def describe(self, input: InputSchema) -> OutputSchema:
    formatParameters = self.formatParameters(input)
    self.fetch = self.fetch(formatParameters)
    self.getResponse = self.getResponse(json=self.fetch.response)
    self.getNewContext = self.getNewContext(messages=self.formatParameters.context)
    self.streamTransform = Nursery.transformStream(board=ChunkTransformer, stream=self.fetch)

    self.output = AttrDict()
    self.output.textOutput = AttrDict(text=self.getResponse.text, context=self.getNewContext.result)
    self.output.toolCallsOutput = AttrDict(toolCalls=self.getResponse.tool_calls, context=self.getNewContext.result)
    self.output.streamOutput = AttrDict(**{"*":self.streamTransform})
    return self.output
  
print("Starting")

a = OpenAiGpt_3_5_Turbo()
print(json.dumps(a, indent=2))

with open("output.json", "w") as f:
  json.dump(a, f, indent=2)

# Testing code.
def sort_fun(obj):
  if isinstance(obj, list):
    if len(obj) > 0 and isinstance(obj[0], tuple):
      for element in obj:
        if element[0] == "id":
          return element[1]
      return obj
  return obj

def ordered(obj):
  if isinstance(obj, dict):
    a = sorted([(k, ordered(v)) for k, v in obj.items()], key=sort_fun)
    return a
  if isinstance(obj, list):
    return sorted([ordered(x) for x in obj], key=sort_fun)
  else:
    return obj
    
def revert_back(obj):
  if isinstance(obj, list):
    if len(obj) > 0 and isinstance(obj[0], tuple):
      return {k: revert_back(v) for k, v in obj}
    else:
      return [revert_back(x) for x in obj]
  if isinstance(obj, dict):
    raise Exception("Very unexpected")
  else:
    return obj

    
from prettydiff import print_diff
comparison_path = "/usr/local/google/home/kevxiao/breadboard/packages/breadboard-web/public/graphs/openai-gpt-35-turbo.json"
with open(comparison_path) as f:
  expected = revert_back(ordered(json.load(f)))
  
actual = revert_back(ordered(json.loads(json.dumps(a))))
print_diff(actual, expected)
print(type(expected))
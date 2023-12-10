/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { NodeNurseryWeb } from "@google-labs/node-nursery-web";

const board = new Board({
  title: "OpenAI GPT-3.5-turbo",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT-3.5 API to generate text.",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const nursery = board.addKit(NodeNurseryWeb);

const toolsExample = [
  {
    name: "The_Calculator_Recipe",
    description:
      "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Ask a math question",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "The_Search_Summarizer_Recipe",
    description:
      "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "What would you like to search for?",
        },
      },
      required: ["text"],
    },
  },
];

const contextExample = [
  {
    role: "system",
    content: "You are a pirate. Please talk like a pirate.",
  },
];

const input = board.input({
  $id: "input",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Text",
        description: "The text to generate",
      },
      tools: {
        type: "array",
        title: "Tools",
        description: "An array of functions to use for tool-calling",
        items: {
          type: "string",
        },
        default: "[]",
        examples: [JSON.stringify(toolsExample, null, 2)],
      },
      context: {
        type: "array",
        title: "Context",
        description: "An array of messages to use as conversation context",
        items: {
          type: "object",
        },
        default: "[]",
        examples: [JSON.stringify(contextExample, null, 2)],
      },
      useStreaming: {
        type: "boolean",
        title: "Stream",
        description: "Whether to stream the output",
        default: "false",
      },
    },
    required: ["text"],
  } satisfies Schema,
});

const textOutput = board.output({
  $id: "textOutput",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Text",
        description: "The generated text",
      },
      context: {
        type: "array",
        title: "Context",
        description: "The conversation context",
      },
    },
  },
});

const toolCallsOutput = board.output({
  $id: "toolCallsOutput",
  schema: {
    type: "object",
    properties: {
      toolCalls: {
        type: "object",
        title: "Tool Calls",
        description: "The generated tool calls",
      },
      context: {
        type: "array",
        title: "Context",
        description: "The conversation context",
      },
    },
  },
});

const streamOutput = board.output({
  $id: "streamOutput",
  schema: {
    type: "object",
    properties: {
      stream: {
        type: "object",
        title: "Stream",
        format: "stream",
        description: "The generated text",
      },
    },
  },
});

const formatParameters = starter
  .jsonata({
    $id: "formatParameters",
    expression: `(
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
        "$error": "\`text\` input is required"
    } : {
        "$error": "\`OPENAI_API_KEY\` input is required"
    }
)`,
    raw: true,
  })
  .wire("<-*", input)
  .wire("<-OPENAI_API_KEY", starter.secrets({ keys: ["OPENAI_API_KEY"] }));

const fetch = starter
  .fetch({
    $id: "callOpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
  })
  .wire("*<-", formatParameters);

const getResponse = starter.jsonata({
  $id: "getResponse",
  expression: `choices[0].message.{
    "text": $boolean(content) ? content,
    "tool_calls": tool_calls.function ~> | $ | { "args": $eval(arguments) }, "arguments" |
}`,
  raw: true,
});

const getNewContext = starter
  .jsonata({
    $id: "getNewContext",
    expression: `$append(messages, response.choices[0].message)`,
  })
  .wire("messages<-context", formatParameters);

const streamTransform = nursery.transformStream(
  (transformBoard, input, output) => {
    const starter = transformBoard.addKit(Starter);

    const transformCompletion = starter.jsonata({
      $id: "transformChunk",
      expression: 'choices[0].delta.content ? choices[0].delta.content : ""',
    });

    input.wire(
      "chunk->json",
      transformCompletion.wire("result->chunk", output)
    );
  }
);

fetch
  .wire(
    "response->json",
    getResponse
      .wire("text->", textOutput)
      .wire("tool_calls->toolCalls", toolCallsOutput)
  )
  .wire(
    "response->",
    getNewContext
      .wire("result->context", textOutput)
      .wire("result->context", toolCallsOutput)
  )
  .wire("stream->", streamTransform.wire("stream->", streamOutput));

export default board;

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  anyOf,
  array,
  board,
  enumeration,
  input,
  object,
  output,
  unsafeType,
} from "@breadboard-ai/build";
import { Schema } from "@google-labs/breadboard";
import { secret, fetch } from "@google-labs/core-kit";
import { jsonata } from "@google-labs/json-kit";

const textPartType = object({ text: "string" });

const imagePartType = object({
  inlineData: object({
    mimeType: enumeration(
      "image/png",
      "image/jpeg",
      "image/heic",
      "image/heif",
      "image/webp"
    ),
    data: "string",
  }),
});

const functionCallPartType = object({
  function_call: object({
    name: "string",
    args: object({}, "string"),
  }),
});

const functionResponsePartType = object({
  function_response: object({
    name: "string",
    response: "unknown",
  }),
});

const partType = anyOf(
  textPartType,
  imagePartType,
  functionCallPartType,
  functionResponsePartType
);

const generateContentContentsType = object({
  role: enumeration("model", "user", "tool", "$metadata"),
  parts: array(partType),
});

const functionDeclaration = object({
  name: "string",
  description: "string",
  parameters: unsafeType<Schema>({ type: "object" }),
});

const textDefault = "What is the correct term for the paddle in cricket?";

const text = input({
  $id: "Text",
  type: "string",
  title: "Text",
  description: "The text to generate",
  default: textDefault,
  examples: ["What is the correct term for the paddle in cricket?"],
});

const toolsExample = [
  {
    name: "The_Calculator_Board",
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
    name: "The_Search_Summarizer_Board",
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

const tools = input({
  $id: "Tools",
  type: array(functionDeclaration),
  title: "Tools",
  description: "An array of functions to use for tool-calling",
  default: [],
  examples: [toolsExample],
});

const contextDefault = [
  {
    role: "user",
    parts: [{ text: "You are a pirate. Please talk like a pirate." }],
  },
  {
    role: "model",
    parts: [{ text: "Arr, matey!" }],
  },
];

const context = input({
  $id: "Context",
  type: array(
    annotate(generateContentContentsType, {
      behavior: ["llm-content"],
    })
  ),
  title: "Context",
  description: "An array of messages to use as conversation context",
  default: [],
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  examples: [contextDefault as any],
});

const formattedRequest = jsonata({
  $id: "formatParameters",
  expression: `(
    $context := $append(
        context ? context, [
            {
                "role": "user",
                "parts": [{ "text": text }]
            }
        ]);
    OPENAI_API_KEY ? text ? {
        "headers": {
            "Content-Type": "application/json",
            "Authorization": "Bearer " & OPENAI_API_KEY
        },
        "body": {
            "model": "gpt-3.5-turbo-1106",
            "messages": [$context.{
              "role": $.role = "model" ? "system" : $.role,
              "content": $.parts.text
            }],
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
  text,
  tools,
  context,
  useStreaming: false,
  raw: true,
  OPENAI_API_KEY: secret("OPENAI_API_KEY"),
});

const fetchResult = fetch({
  $id: "callOpenAI",
  url: "https://api.openai.com/v1/chat/completions",
  method: "POST",
  headers: formattedRequest.unsafeOutput("headers"),
  body: formattedRequest.unsafeOutput("body"),
});

const jsonResponse = jsonata({
  $id: "getResponse",
  expression: `choices[0].message.{
      "text": $boolean(content) ? content,
      "tool_calls": tool_calls.function ~> | $ | { "args": $eval(arguments) }, "arguments" |
    }`,
  raw: true,
  json: fetchResult.outputs.response,
});

const getNewContext = jsonata({
  $id: "getNewContext",
  expression: `$append(messages, response.choices[0].message)`,
  messages: formattedRequest.unsafeOutput("context"),
});

export default board({
  title: "OpenAI GPT-3.5-turbo",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT-3.5 API to generate text.",
  version: "0.1.0",
  inputs: { text, tools, context },
  outputs: {
    context: output(getNewContext.unsafeOutput("result")),
    text: output(jsonResponse.unsafeOutput("text")),
    toolCalls: output(jsonResponse.unsafeOutput("tool_calls")),
  },
});

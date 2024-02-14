/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata, Schema, base, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";
import { nursery } from "@google-labs/node-nursery-web";
import { chunkTransformer } from "./openai-chunk-transformer";

const metadata = {
  title: "OpenAI GPT-3.5-turbo",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT-3.5 API to generate text.",
  version: "0.0.2",
} satisfies GraphMetadata;

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

const contextExample = [
  {
    role: "system",
    content: "You are a pirate. Please talk like a pirate.",
  },
];

const inputSchema = {
  type: "object",
  properties: {
    text: {
      type: "string",
      title: "Text",
      description: "The text to generate",
      examples: ["What is the correct term for the paddle in cricket?"],
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
} satisfies Schema;

const textOutputSchema = {
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
} satisfies Schema;

const toolOutputSchema = {
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
} satisfies Schema;

const streamOutputSchema = {
  type: "object",
  properties: {
    stream: {
      type: "object",
      title: "Stream",
      format: "stream",
      description: "The generated text",
    },
  },
} satisfies Schema;

export default await board(() => {
  const input = base.input({ $id: "input", schema: inputSchema });

  const streamOutput = base.output({
    $id: "streamOutput",
    schema: streamOutputSchema,
  });

  const formatParameters = input.to(
    json.jsonata({
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
      OPENAI_API_KEY: core.secrets({ keys: ["OPENAI_API_KEY"] }),
    })
  );

  const fetch = formatParameters.to(
    core.fetch({
      $id: "callOpenAI",
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
    })
  );

  const getResponse = json.jsonata({
    $id: "getResponse",
    expression: `choices[0].message.{
      "text": $boolean(content) ? content,
      "tool_calls": tool_calls.function ~> | $ | { "args": $eval(arguments) }, "arguments" |
    }`,
    raw: true,
    json: fetch.response,
  });

  const getNewContext = json.jsonata({
    $id: "getNewContext",
    expression: `$append(messages, response.choices[0].message)`,
    messages: formatParameters.context,
  });

  base.output({
    $id: "textOutput",
    schema: textOutputSchema,
    context: getNewContext.result,
    text: getResponse.text,
  });

  base.output({
    $id: "toolCallsOutput",
    schema: toolOutputSchema,
    context: getNewContext.result,
    toolCalls: getResponse.tool_calls,
  });

  return nursery
    .transformStream({
      $id: "streamTransform",
      board: chunkTransformer,
      stream: fetch,
    })
    .to(streamOutput);
}).serialize(metadata);

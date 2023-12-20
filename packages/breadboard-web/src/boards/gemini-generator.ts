/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Board,
  GraphMetadata,
  Schema,
  V,
  base,
  recipe,
} from "@google-labs/breadboard";
import Starter, { starter } from "@google-labs/llm-starter";
import NodeNurseryWeb, { nursery } from "@google-labs/node-nursery-web";

type TextPartType = {
  text: string;
};

type ImagePartType = {
  inline_data: {
    mime_type:
      | "image/png"
      | "image/jpeg"
      | "image/heic"
      | "image/heif"
      | "image/webp";
    data: string;
  };
};

type FunctionCallPartType = {
  function_call: {
    name: string;
    args: Record<string, string>;
  };
};

type FunctionResponsePartType = {
  function_response: {
    name: string;
    response: unknown;
  };
};

type PartType =
  | TextPartType
  | ImagePartType
  | FunctionCallPartType
  | FunctionResponsePartType;

type GenerateContentContentsType = {
  role: "model" | "user" | "tool";
  parts: PartType[];
};

type FunctionDeclaration = {
  name: string;
  description: string;
  parameters?: Schema;
};

const metadata = {
  title: "Gemini Pro Generator",
  description: "The text generator recipe powered by the Gemini Pro model",
  version: "0.0.2",
} as GraphMetadata;

// const board = new Board(metadata);
// const starter = board.addKit(Starter);
// const nursery = board.addKit(NodeNurseryWeb);

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
] satisfies FunctionDeclaration[];

const contextExample = [
  {
    role: "user",
    parts: [
      {
        text: "You are a pirate. Please talk like a pirate.",
      },
    ],
  },
  {
    role: "model",
    parts: [
      {
        text: "Arr, matey!",
      },
    ],
  },
] satisfies GenerateContentContentsType[];

const parametersSchema = {
  type: "object",
  properties: {
    text: {
      type: "string",
      title: "Text",
      description: "The text to generate",
      examples: ["What is the square root of pi?"],
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

const toolCallOutputSchema = {
  type: "object",
  properties: {
    toolCalls: {
      type: "array",
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

export default await recipe(async () => {
  const parameters = base.input({
    $id: "parameters",
    schema: parametersSchema,
  });

  function chooseMethodFunction({ useStreaming }: { useStreaming: boolean }) {
    const method = useStreaming ? "streamGenerateContent" : "generateContent";
    const sseOption = useStreaming ? "&alt=sse" : "";
    return { method, sseOption };
  }

  const chooseMethod = starter.runJavascript({
    $id: "chooseMethod",
    name: "chooseMethodFunction",
    code: chooseMethodFunction.toString(),
    raw: true,
    useStreaming: parameters,
  });

  const makeUrl = starter
    .urlTemplate({
      $id: "makeURL",
      template:
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:{method}?key={GEMINI_KEY}{+sseOption}",
      GEMINI_KEY: starter.secrets({ keys: ["GEMINI_KEY"] }),
    })
    .in(chooseMethod);

  const makeBody = starter.jsonata({
    $id: "makeBody",
    expression: `(
      $context := $append(
          context ? context, [
              {
                  "role": "user",
                  "parts": [
                      {
                          "text": text
                      }
                  ]
              }
          ]);
      text ? {
          "contents": $context, 
          "tools": tools ? {
            "function_declarations": tools
          }
      } : {
          "$error": "\`text\` input is required"
      }
    )`,
  });
  parameters.to(makeBody);

  const fetch = starter.fetch({
    $id: "callGeminiAPI",
    method: "POST",
    stream: parameters.useStreaming,
    url: makeUrl.url,
    body: makeBody.result,
  });

  const formatResponse = starter.jsonata({
    $id: "formatResponse",
    expression: `
  response.candidates[0].content.parts.{
    "text": text ? text,
    "toolCalls": functionCall ? [ functionCall ],
    "context": $append($$.context, %.$)
  }`,
    raw: true,
    response: fetch,
  });

  const streamTransform = nursery.transformStream({
    $id: "streamTransform",
    board: recipe(async () => {
      const transformChunk = starter.jsonata({
        $id: "transformChunk",
        expression:
          "candidates[0].content.parts.text ? $join(candidates[0].content.parts.text) : ''",
        json: base.input({}).chunk as V<string>,
      });
      return base.output({ chunk: transformChunk.result });
    }),
    stream: fetch,
  });

  base.output({
    $id: "textOutput",
    schema: textOutputSchema,
    context: formatResponse,
    text: formatResponse,
  });

  base.output({
    $id: "toolCallsOutput",
    schema: toolCallOutputSchema,
    context: formatResponse,
    toolCalls: formatResponse,
  });

  return base.output({
    $id: "streamOutput",
    schema: streamOutputSchema,
    stream: streamTransform,
  });
}).serialize(metadata);

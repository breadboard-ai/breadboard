/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import Starter from "@google-labs/llm-starter";
import NodeNurseryWeb from "@google-labs/node-nursery-web";

const board = new Board({
  title: "Gemini Pro Generator",
  description: "The text generator recipe powered by the Gemini Pro model",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const nursery = board.addKit(NodeNurseryWeb);

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

type Tool = {
  function_declarations: {
    name: string;
    description: string;
    parameters?: Schema;
  }[];
};

const toolsExample = [
  {
    function_declarations: [
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
    ],
  },
] satisfies Tool[];

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

const parameters = board.input({
  $id: "parameters",
  schema: {
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

const functionCallOutput = board.output({
  $id: "toolCallsOutput",
  schema: {
    type: "object",
    properties: {
      functionCall: {
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

function chooseMethodFunction({ useStreaming }: { useStreaming: boolean }) {
  const method = useStreaming ? "streamGenerateContent" : "generateContent";
  const sseOption = useStreaming ? "&alt=sse" : "";
  return { method, sseOption };
}

const chooseMethod = starter
  .runJavascript({
    $id: "chooseMethod",
    name: "chooseMethodFunction",
    code: chooseMethodFunction.toString(),
    raw: true,
  })
  .wire("<-useStreaming", parameters);

const url = starter
  .urlTemplate({
    $id: "makeURL",
    template:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:{method}?key={GEMINI_KEY}{+sseOption}",
  })
  .wire("<-GEMINI_KEY", starter.secrets({ keys: ["GEMINI_KEY"] }))
  .wire("<-method", chooseMethod)
  .wire("<-sseOption", chooseMethod);

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
        "tools": tools 
    } : {
        "$error": "\`text\` input is required"
    }
)`,
});

const fetch = starter
  .fetch({
    $id: "callGeminiAPI",
    method: "POST",
  })
  .wire("stream<-useStreaming", parameters)
  .wire("<-url", url);

const formatResponse = starter.jsonata({
  $id: "formatResponse",
  expression: `
  response.candidates[0].content.parts.{
    "text": text ? text,
    "functionCall": functionCall ? functionCall ,
    "context": $append($$.context, %.$)
}`,
  raw: true,
});

const streamTransform = nursery.transformStream(
  (transformBoard, input, output) => {
    const starter = transformBoard.addKit(Starter);

    const transformChunk = starter.jsonata({
      $id: "transformChunk",
      expression:
        "candidates[0].content.parts.text ? $join(candidates[0].content.parts.text) : ''",
    });

    input.wire("chunk->json", transformChunk.wire("result->chunk", output));
  }
);

parameters.wire(
  "*->",
  makeBody.wire(
    "result->body",
    fetch
      .wire(
        "response->response",
        formatResponse
          .wire("functionCall->", functionCallOutput)
          .wire("text->", textOutput)
          .wire("context->", textOutput)
          .wire("context->", functionCallOutput)
          .wire("<-context", parameters)
      )
      .wire("stream->", streamTransform.wire("stream->", streamOutput))
  )
);

export default board;

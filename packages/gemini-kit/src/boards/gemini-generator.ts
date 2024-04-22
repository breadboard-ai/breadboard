/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphMetadata,
  Schema,
  V,
  base,
  board,
  code,
} from "@google-labs/breadboard";
import { templates } from "@google-labs/template-kit";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";
import { nursery } from "@google-labs/node-nursery-web";

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
  description: "The text generator board powered by the Gemini Pro model",
  version: "0.0.2",
} as GraphMetadata;

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
    systemInstruction: {
      type: "string",
      title: "System Instruction",
      description:
        "Give the model additional context to understand the task, provide more customized responses, and adhere to specific guidelines over the full user interaction.",
      examples: [
        "You are a brilliant poet, specializing in two-line rhyming poems. You also happened to be a cat.",
      ],
      default: "",
    },
    text: {
      type: "string",
      title: "Text",
      description: "The text to generate",
      examples: ["What is the square root of pi?"],
      default: "",
    },
    model: {
      type: "string",
      title: "Model",
      description: "The model to use for generation",
      enum: ["gemini-pro", "gemini-ultra", "gemini-1.5-pro-latest"],
      examples: ["gemini-1.5-pro-latest"],
    },
    tools: {
      type: "array",
      title: "Tools",
      description: "An array of functions to use for tool-calling",
      items: {
        type: "object",
        behavior: ["board"],
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
        behavior: ["llm-content"],
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
    safetySettings: {
      type: "object",
      title: "Safety Settings",
      description:
        "The safety settings object (see https://ai.google.dev/api/rest/v1beta/SafetySetting for more information)",
      default: "{}",
    },
    stopSequences: {
      type: "array",
      title: "Stop Sequences",
      description: "An array of strings that will stop the output",
      items: {
        type: "string",
      },
      default: "[]",
    },
  },
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
      items: {
        type: "object",
        behavior: ["llm-content"],
      },
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
      items: {
        type: "object",
      },
      title: "Tool Calls",
      description: "The generated tool calls",
    },
    context: {
      type: "array",
      items: {
        type: "object",
        behavior: ["llm-content"],
      },
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

const bodyBuilder = code(
  ({
    context,
    systemInstruction,
    text,
    model,
    tools,
    safetySettings,
    stopSequences,
  }) => {
    let contents = context as unknown[];
    const olderModel = model === "gemini-pro" || model === "gemini-ultra";
    const turn = [{ role: "user", parts: [{ text }] }];
    if (!contents || contents.length === 0) {
      if (text) {
        contents = turn;
      } else {
        throw new Error("Either `text` or `context` parameter is required");
      }
    } else {
      const last = contents[contents.length - 1] as { role: string };
      if (last.role === "model") {
        contents.push(turn);
      }
    }
    const result: Record<string, unknown> = { contents };
    if (systemInstruction) {
      const part = { text: systemInstruction };
      if (olderModel) {
        turn[turn.length - 1].parts.unshift(part);
      } else {
        result["system_instruction"] = { parts: [part] };
      }
    }
    if (safetySettings && !Object.keys(safetySettings).length) {
      result["safetySettings"] = [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ];
    } else {
      result["safetySettings"] = safetySettings;
    }
    if (stopSequences && (stopSequences as unknown[]).length > 0) {
      result["generationConfig"] = { stopSequences };
    }
    if (tools && (tools as unknown[]).length > 0) {
      result["tools"] = { function_declarations: tools };
    }
    return { result };
  }
);

export default await board(() => {
  const parameters = base.input({
    $id: "parameters",
    schema: parametersSchema,
  });

  function chooseMethodFunction({ useStreaming }: { useStreaming: boolean }) {
    const method = useStreaming ? "streamGenerateContent" : "generateContent";
    const sseOption = useStreaming ? "&alt=sse" : "";
    return { method, sseOption };
  }

  const chooseMethod = core.runJavascript({
    $id: "chooseMethod",
    name: "chooseMethodFunction",
    code: chooseMethodFunction.toString(),
    raw: true,
    useStreaming: parameters,
  });

  const makeUrl = templates.urlTemplate({
    $id: "makeURL",
    template:
      "https://generativelanguage.googleapis.com/v1beta/models/{model}:{method}?key={GEMINI_KEY}{+sseOption}",
    GEMINI_KEY: core.secrets({ keys: ["GEMINI_KEY"] }),
    model: parameters.model,
    ...chooseMethod,
  });

  const makeBody = bodyBuilder({
    $metadata: { title: "Make Request Body" },
    ...parameters,
  });

  const fetch = core.fetch({
    $id: "callGeminiAPI",
    method: "POST",
    stream: parameters.useStreaming,
    url: makeUrl.url,
    body: makeBody.result,
  });

  const formatResponse = json.jsonata({
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
    board: board(() => {
      const transformChunk = json.jsonata({
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

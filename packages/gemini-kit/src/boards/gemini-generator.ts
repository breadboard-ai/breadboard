/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphInlineMetadata,
  Schema,
  base,
  board,
  code,
} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";

type TextPartType = {
  text: string;
};

type ImagePartType = {
  inlineData: {
    mimeType:
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
  role: "model" | "user" | "tool" | "$metadata";
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
} as GraphInlineMetadata;

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
    responseMimeType: {
      type: "string",
      title: "Response MIME Type",
      description: "Output response mimetype of the generated text.",
      enum: ["text/plain", "application/json"],
      examples: ["text/plain"],
      default: "text/plain",
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
    retry: {
      type: "number",
      title: "Retry Count",
      description:
        "The number of times to retry the LLM call in case of failure",
      default: "1",
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

// const streamOutputSchema = {
//   type: "object",
//   properties: {
//     stream: {
//       type: "object",
//       title: "Stream",
//       format: "stream",
//       description: "The generated text",
//     },
//   },
// } satisfies Schema;

const retryCounter = code((inputs) => {
  type FetchError = { error?: { code?: number } };
  const retry = (inputs.retry as number) || 0;
  const error = inputs.error as FetchError;
  const errorCode = error?.error?.code;
  if (errorCode) {
    // Retry won't help with 404, 429 or 400, because these are either the
    // caller's problem or in case of 429, retries are actually doing more harm
    // than good.
    const retryWontHelp =
      errorCode == 400 || errorCode == 429 || errorCode == 404;
    if (retryWontHelp) {
      return { $error: { error } };
    }
    // The "-1" value is something that responseFormatter sends when empty
    // response is encountered.
    if (errorCode == -1) {
      return { $error: error };
    }
  }
  if (retry < 0)
    return {
      $error: {
        error:
          "Exceeded retry count, was unable to produce a useful response from the Gemini API.",
      },
    };
  inputs.retry = retry - 1;
  return inputs;
});

const bodyBuilder = code(
  ({
    context,
    systemInstruction,
    responseMimeType,
    text,
    model,
    tools,
    safetySettings,
    stopSequences,
  }) => {
    type Part = { text: unknown };
    type Content = { role?: string; parts: Part[] };
    let contents = context as Content[];
    const olderModel = model === "gemini-pro" || model === "gemini-ultra";
    const turn: Content = { role: "user", parts: [{ text }] };
    if (!contents || contents.length === 0) {
      if (text) {
        contents = [turn];
      } else {
        throw new Error("Either `text` or `context` parameter is required");
      }
    } else {
      const last = contents[contents.length - 1] as Content;
      if (last.role === "model") {
        contents.push(turn);
      }
    }
    // Filter out the special "$metadata" role.
    contents = contents.filter((item) => item.role !== "$metadata");
    const result: Record<string, unknown> = { contents };
    if (systemInstruction) {
      let parts;
      if (typeof systemInstruction === "string") {
        parts = [{ text: systemInstruction }];
      } else {
        parts = (systemInstruction as Content).parts;
        if (!parts) {
          throw new Error(
            `Malformed system instruction: ${JSON.stringify(systemInstruction)}`
          );
        }
      }
      if (olderModel) {
        contents[contents.length - 1].parts.unshift(...parts);
      } else {
        result["systemInstruction"] = { parts };
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
    const generationConfig = {} as {
      stopSequences?: unknown;
      responseMimeType?: unknown;
    };
    if (stopSequences && (stopSequences as unknown[]).length > 0) {
      generationConfig.stopSequences = stopSequences;
    }
    if (responseMimeType) {
      generationConfig.responseMimeType = responseMimeType;
    }
    if (Object.keys(generationConfig).length > 0) {
      result["generationConfig"] = generationConfig;
    }
    if (tools && (tools as unknown[]).length > 0) {
      result["tools"] = { function_declarations: tools };
    }
    return { result };
  }
);

const responseFormatter = code(({ response }) => {
  type Part = { text: string } | { functionCall: unknown };
  type ContentItem = { content: { parts: Part[] } };
  type Response = { candidates: ContentItem[] } | undefined;
  const r = response as Response;
  const context = r?.candidates?.[0].content;
  const firstPart = context?.parts?.[0];
  if (!firstPart) {
    return {
      $error: {
        error: {
          message: `No parts in response "${JSON.stringify(response)}" found`,
          code: -1,
        },
      },
    };
  }
  if ("text" in firstPart) {
    return { text: firstPart.text, context };
  } else {
    return { toolCalls: firstPart.functionCall, context };
  }
});

const methodChooser = code(({ useStreaming }) => {
  const method = useStreaming ? "streamGenerateContent" : "generateContent";
  const sseOption = useStreaming ? "&alt=sse" : "";
  return { method, sseOption };
});

export default await board(() => {
  const parameters = base.input({
    $id: "inputs",
    $metadata: {
      title: "Input Parameters",
      description: "Collecting input parameters",
    },
    schema: parametersSchema,
  });

  const chooseMethod = methodChooser({
    $id: "choose-method",
    $metadata: {
      title: "Choose Method",
      description: "Choosing the right Gemini API method",
    },
    useStreaming: parameters.useStreaming,
  });

  const makeUrl = templates.urlTemplate({
    $id: "make-url",
    $metadata: {
      title: "Make URL",
      description: "Creating the Gemini API URL",
    },
    template:
      "https://generativelanguage.googleapis.com/v1beta/models/{model}:{method}?key={GEMINI_KEY}{+sseOption}",
    GEMINI_KEY: core.secrets({
      $id: "GEMINI_KEY-secret",
      keys: ["GEMINI_KEY"],
    }),
    model: parameters.model,
    method: chooseMethod.method,
    sseOption: chooseMethod.sseOption,
  });

  const countRetries = retryCounter({
    $id: "count-retries",
    $metadata: {
      title: "Check Retry Count",
      description: "Making sure we can retry, if necessary.",
    },
    context: parameters.context.memoize(),
    systemInstruction: parameters.systemInstruction.memoize(),
    text: parameters.text.memoize(),
    model: parameters.model.memoize(),
    tools: parameters.tools.memoize(),
    safetySettings: parameters.safetySettings.memoize(),
    stopSequences: parameters.stopSequences.memoize(),
    responseMimeType: parameters.responseMimeType.memoize(),
    retry: parameters.retry,
    error: {},
  });

  const makeBody = bodyBuilder({
    $id: "make-body",
    $metadata: { title: "Make Request Body" },
    context: countRetries.context,
    systemInstruction: countRetries.systemInstruction,
    text: countRetries.text,
    model: countRetries.model,
    tools: countRetries.tools,
    safetySettings: countRetries.safetySettings,
    stopSequences: countRetries.stopSequences,
    responseMimeType: countRetries.responseMimeType,
  });

  const fetch = core.fetch({
    $id: "fetch-gemini-api",
    $metadata: { title: "Make API Call", description: "Calling Gemini API" },
    method: "POST",
    stream: parameters.useStreaming.memoize(),
    url: makeUrl.url.memoize(),
    body: makeBody.result,
  });

  const errorCollector = core.passthrough({
    $id: "collect-errors",
    $metadata: {
      title: "Collect Errors",
      description: "Collecting the error from Gemini API",
    },
    error: fetch.$error,
    retry: countRetries.retry,
  });

  errorCollector.retry.to(countRetries);
  errorCollector.error.to(countRetries);

  const formatResponse = responseFormatter({
    $id: "format-response",
    $metadata: {
      title: "Format Response",
      description: "Formatting Gemini API response",
    },
    response: fetch.response,
  });

  formatResponse.$error.as("error").to(errorCollector);

  // TODO(aomarks) Streaming is not working. Temporarily removing streaming
  // support to ease the conversion of this board to the new API.

  // const streamTransform = nursery.transformStream({ $metadata: { title:
  //   "Transform Stream", description: "Transforming the API output stream to
  //   be consumable",
  //   },
  //   board: board(() => { const transformChunk = json.jsonata({ $id:
  //     "transformChunk", expression: "candidates[0].content.parts.text ?
  //     $join(candidates[0].content.parts.text) : ''", json:
  //     base.input({}).chunk as V<string>,
  //     });
  //     return base.output({ chunk: transformChunk.result });
  //   }),
  //   stream: fetch,
  // });

  base.output({
    $id: "content-output",
    $metadata: { title: "Content Output", description: "Outputting content" },
    schema: textOutputSchema,
    context: formatResponse,
    text: formatResponse,
  });

  return base.output({
    $id: "tool-call-output",
    $metadata: {
      title: "Tool Call Output",
      description: "Outputting a tool call",
    },
    schema: toolCallOutputSchema,
    context: formatResponse,
    toolCalls: formatResponse,
  });

  // return base.output({
  //   $metadata: { title: "Stream Output", description: "Outputting a stream" },
  //   schema: streamOutputSchema,
  //   stream: streamTransform,
  // });
}).serialize(metadata);

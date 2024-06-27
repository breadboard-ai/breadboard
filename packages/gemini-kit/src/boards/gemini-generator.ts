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
  constant,
  converge,
  enumeration,
  input,
  loopback,
  object,
  optional,
  output,
  unsafeCast,
  unsafeType,
} from "@breadboard-ai/build";
import { ConvertBreadboardType } from "@breadboard-ai/build/internal/type-system/type.js";
import { Schema } from "@google-labs/breadboard";
import { code, fetch, passthrough, secret } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";

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

const systemInstruction = input({
  type: "string",
  title: "System Instruction",
  description:
    "Give the model additional context to understand the task, provide more customized responses, and adhere to specific guidelines over the full user interaction.",
  examples: [
    "You are a brilliant poet, specializing in two-line rhyming poems. You also happened to be a cat.",
  ],
  default: "",
});

const text = input({
  type: "string",
  title: "Text",
  description: "The text to generate",
  examples: ["What is the square root of pi?"],
  default: "",
});

const model = input({
  title: "Model",
  description: "The model to use for generation",
  type: enumeration("gemini-1.5-flash-latest", "gemini-1.5-pro-latest"),
  examples: ["gemini-1.5-flash-latest"],
  optional: true,
});

const responseMimeType = input({
  title: "Response MIME Type",
  description: "Output response mimetype of the generated text.",
  type: enumeration("text/plain", "application/json"),
  examples: ["text/plain"],
  default: "text/plain",
});

const tools = input({
  type: array(
    annotate(functionDeclaration, {
      behavior: ["board"],
    })
  ),
  title: "Tools",
  description: "An array of functions to use for tool-calling",
  default: [],
  examples: [
    [
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
    ],
  ],
});

const context = input({
  type: array(
    annotate(generateContentContentsType, {
      behavior: ["llm-content"],
    })
  ),
  title: "Context",
  description: "An array of messages to use as conversation context",
  default: [],
  examples: [
    [
      {
        role: "user",
        parts: [{ text: "You are a pirate. Please talk like a pirate." }],
      },
      {
        role: "model",
        parts: [{ text: "Arr, matey!" }],
      },
    ],
  ],
});

const useStreaming = input({
  type: "boolean",
  title: "Stream",
  description: "Whether to stream the output",
  default: false,
});

const retry = input({
  type: "number",
  title: "Retry Count",
  description: "The number of times to retry the LLM call in case of failure",
  default: 1,
});

const safetySettings = input({
  type: array(
    object({
      category: "string",
      threshold: "string",
    })
  ),
  title: "Safety Settings",
  description:
    "The safety settings object (see https://ai.google.dev/api/rest/v1beta/SafetySetting for more information)",
  default: [],
});

const stopSequences = input({
  type: array("string"),
  title: "Stop Sequences",
  description: "An array of strings that will stop the output",
  default: [],
});

const requestBodyType = object({
  contents: "unknown",
  systemInstruction: optional(
    object({
      parts: array("unknown"),
    })
  ),
  safetySettings: optional(
    array(
      object({
        category: "string",
        threshold: "string",
      })
    )
  ),
  generationConfig: optional(
    object({
      stopSequences: optional(array("string")),
      responseMimeType: optional(enumeration("text/plain", "application/json")),
    })
  ),
  tools: optional(
    object({
      function_declarations: array(functionDeclaration),
    })
  ),
});

const { method, sseOption } = code(
  {
    $id: "choose-method",
    useStreaming,
    $metadata: {
      title: "Choose Method",
      description: "Choosing the right Gemini API method",
    },
  },
  {
    method: enumeration("streamGenerateContent", "generateContent"),
    sseOption: "string",
  },
  ({ useStreaming }) => {
    const method = useStreaming ? "streamGenerateContent" : "generateContent";
    const sseOption = useStreaming ? "&alt=sse" : "";
    return { method, sseOption };
  }
).outputs;

const makeUrl = urlTemplate({
  $id: "make-url",
  $metadata: {
    title: "Make URL",
    description: "Creating the Gemini API URL",
  },
  template:
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:{method}?key={GEMINI_KEY}{+sseOption}",
  GEMINI_KEY: secret("GEMINI_KEY"),
  model,
  method,
  sseOption,
});

const errorLoopback = loopback({
  type: object({
    error: optional(
      object({
        message: optional("string"),
      })
    ),
  }),
});

const retryLoopback = loopback({ type: "number" });

export type ErrorResponse = {
  error?: {
    message?: string;
    code?: number;
  };
};

const countRetries = code(
  {
    $id: "count-retries",
    $metadata: {
      title: "Check Retry Count",
      description: "Making sure we can retry, if necessary.",
    },
    context: constant(context),
    systemInstruction: constant(systemInstruction),
    text: constant(text),
    model: constant(model),
    tools: constant(tools),
    safetySettings: constant(safetySettings),
    stopSequences: constant(stopSequences),
    responseMimeType: constant(responseMimeType),
    retry: converge(retry, retryLoopback),
    error: converge({} as { error?: { message?: string } }, errorLoopback),
  },
  {
    // TODO(aomarks) A better way to generate these types.
    context: array(generateContentContentsType),
    systemInstruction: anyOf("string", object({ parts: array(partType) })),
    text: "string",
    model: "string",
    tools: array(functionDeclaration),
    safetySettings: array(object({ category: "string", threshold: "string" })),
    stopSequences: array("string"),
    responseMimeType: enumeration("text/plain", "application/json"),
    retry: "number",
  },
  ({ retry, error, ...rest }) => {
    retry = retry || 0;
    let errorResponse: ErrorResponse = {};
    try {
      errorResponse = JSON.parse(error?.error?.message || "null");
    } catch (e) {
      // Ignore the error
    }
    const errorCode = errorResponse?.error?.code;
    if (errorCode) {
      // Retry won't help with 404, 429 or 400, because these are either the
      // caller's problem or in case of 429, retries are actually doing more harm
      // than good.
      const retryWontHelp =
        errorCode == 400 || errorCode == 429 || errorCode == 404;
      if (retryWontHelp) {
        // TODO(aomarks) We don't have `code` in the general $error type, and we
        // probably shouldn't since there are all kind of possible error shapes.
        // There should probably be a way to set the schema for $error to any
        // sub-type of the general one on a node-by-node basis. For now we just
        // cast to pretend `code` isn't there.
        return { $error: error as { message: string } };
      }
      // The "-1" value is something that responseFormatter sends when empty
      // response is encountered.
      if (errorCode == -1) {
        return { $error: error as { message: string } };
      }
    }
    if (retry < 0) {
      return {
        $error:
          "Exceeded retry count, was unable to produce a useful response from the Gemini API.",
      };
    }
    retry = retry - 1;
    return { ...rest, retry };
  }
);

const body = code(
  {
    $id: "make-body",
    $metadata: { title: "Make Request Body" },
    context: countRetries.outputs.context,
    systemInstruction: countRetries.outputs.systemInstruction,
    text: countRetries.outputs.text,
    model: countRetries.outputs.model,
    tools: countRetries.outputs.tools,
    safetySettings: countRetries.outputs.safetySettings,
    stopSequences: countRetries.outputs.stopSequences,
    responseMimeType: countRetries.outputs.responseMimeType,
  },
  { result: requestBodyType },
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
    let contents = context;
    const olderModel = model === "gemini-pro" || model === "gemini-ultra";
    const turn = { role: "user" as const, parts: [{ text }] };
    if (!contents || contents.length === 0) {
      if (text) {
        contents = [turn];
      } else {
        throw new Error("Either `text` or `context` parameter is required");
      }
    } else {
      // Replace the "tool" role with "user".
      contents = contents.map((item) =>
        item.role === "tool" ? ((item.role = "user"), item) : item
      );
      const last = contents[contents.length - 1];
      if (last.role === "model") {
        contents.push(turn);
      }
    }
    // Filter out the special "$metadata" role.
    contents = contents.filter((item) => item.role !== "$metadata");
    const result: ConvertBreadboardType<typeof requestBodyType> = { contents };
    if (systemInstruction) {
      let parts;
      if (typeof systemInstruction === "string") {
        parts = [{ text: systemInstruction }];
      } else {
        parts = systemInstruction.parts;
        if (!parts) {
          throw new Error(
            `Malformed system instruction: ${JSON.stringify(systemInstruction)}`
          );
        }
      }
      if (olderModel) {
        contents[contents.length - 1].parts.unshift(...parts);
      } else {
        result.systemInstruction = { parts };
      }
    }
    if (safetySettings && !Object.keys(safetySettings).length) {
      result.safetySettings = [
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
      result.safetySettings = safetySettings;
    }
    const generationConfig: {
      stopSequences?: string[];
      responseMimeType?: "text/plain" | "application/json";
    } = {};
    if (stopSequences && stopSequences.length > 0) {
      generationConfig.stopSequences = stopSequences;
    }
    if (responseMimeType) {
      generationConfig.responseMimeType = responseMimeType;
    }
    if (Object.keys(generationConfig).length > 0) {
      result.generationConfig = generationConfig;
    }
    if (tools && tools.length > 0) {
      result.tools = { function_declarations: tools };
    }
    return { result };
  }
).outputs.result;

const responseContentType = object({
  parts: array(
    anyOf(
      object({
        text: "string",
      }),
      object({
        functionCall: "unknown",
      })
    )
  ),
});

const responseType = object({
  candidates: array(
    object({
      content: responseContentType,
    })
  ),
});

const fetchResult = fetch({
  $id: "fetch-gemini-api",
  $metadata: { title: "Make API Call", description: "Calling Gemini API" },
  method: "POST",
  stream: constant(useStreaming),
  url: constant(makeUrl),
  body,
});

const response = unsafeCast(fetchResult.outputs.response, responseType);

const formattedResponse = code(
  {
    $id: "format-response",
    $metadata: {
      title: "Format Response",
      description: "Formatting Gemini API response",
    },
    response,
  },
  {
    text: {
      type: "string",
      optional: true,
    },
    context: responseContentType,
    toolCalls: {
      type: array(object({}, "unknown")),
      optional: true,
    },
  },
  ({ response }) => {
    const r = response;
    const context = r?.candidates?.[0].content;
    const firstPart = context?.parts?.[0];
    if (!firstPart) {
      return {
        $error: `No parts in response "${JSON.stringify(response)}" found`,
      };
    }
    if ("text" in firstPart) {
      return { text: firstPart.text, context };
    } else {
      return { toolCalls: [], context };
    }
  }
);

const errorCollector = passthrough({
  $id: "collect-errors",
  $metadata: {
    title: "Collect Errors",
    description: "Collecting the error from Gemini API",
  },
  error: converge(fetchResult.outputs.$error, formattedResponse.outputs.$error),
  retry: countRetries.outputs.retry,
});

retryLoopback.resolve(errorCollector.outputs.retry);
errorLoopback.resolve(errorCollector.outputs.error);

//   const streamTransform = nursery.transformStream({
//     $metadata: {
//       title: "Transform Stream",
//       description: "Transforming the API output stream to be consumable",
//     },
//     board: board(() => {
//       const transformChunk = json.jsonata({
//         $id: "transformChunk",
//         expression:
//           "candidates[0].content.parts.text ? $join(candidates[0].content.parts.text) : ''",
//         json: base.input({}).chunk as V<string>,
//       });
//       return base.output({ chunk: transformChunk.result });
//     }),
//     stream: fetch,
//   });

//   return base.output({
//     $metadata: { title: "Stream Output", description: "Outputting a stream" },
//     schema: streamOutputSchema,
//     stream: streamTransform,
//   });
// }).serialize(metadata);

export default board({
  title: "Gemini Pro Generator",
  description: "The text generator board powered by the Gemini Pro model",
  version: "0.1.0",
  inputs: [
    {
      $id: "inputs",
      $metadata: {
        title: "Input Parameters",
        description: "Collecting input parameters",
      },
      systemInstruction,
      text,
      model,
      responseMimeType,
      tools,
      context,
      useStreaming,
      retry,
      safetySettings,
      stopSequences,
    },
  ],
  outputs: [
    {
      $id: "content-output",
      $metadata: {
        title: "Content Output",
        description: "Outputting content",
      },
      context: output(formattedResponse.outputs.context, {
        title: "Context",
        description: "The conversation context",
      }),
      text: output(formattedResponse.outputs.text, {
        title: "Text",
        description: "The generated text",
      }),
    },
    {
      $id: "tool-call-output",
      $metadata: {
        title: "Tool Call Output",
        description: "Outputting a tool call",
      },
      context: output(formattedResponse.outputs.context, {
        title: "Context",
        description: "The conversation context",
      }),
      toolCalls: output(formattedResponse.outputs.toolCalls, {
        title: "Tool Calls",
        description: "The generated tool calls",
      }),
    },
  ],
});

/**
 * @license
 * Copyright 2024 Google LLC
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
  defineNodeType,
  object,
  optional,
  output,
  unsafeCast,
  unsafeType,
} from "@breadboard-ai/build";
import {
  ConvertBreadboardType,
  JsonSerializable,
} from "@breadboard-ai/build/internal/type-system/type.js";
import { code, fetch, passthrough, secret } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import {
  DataStore,
  NodeHandlerContext,
  StreamCapability,
  asBlob,
  inflateData,
  isDataCapability,
} from "@google-labs/breadboard";

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

const filePartType = object({
  fileData: object({
    fileUri: "string",
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
  filePartType,
  functionCallPartType,
  functionResponsePartType
);

const generateContentContentsType = object({
  role: enumeration("model", "user", "tool", "$metadata"),
  parts: array(partType),
});

const context = input({
  type: array(
    annotate(generateContentContentsType, {
      behavior: ["llm-content"],
    })
  ),
});

const makeUrl = urlTemplate({
  $id: "make-file-api-url",
  $metadata: {
    title: "Make URL",
    description: "Creating the Gemini File API URL",
  },
  template:
    "https://generativelanguage.googleapis.com/upload/v1beta/files?key={GEMINI_KEY}",
  GEMINI_KEY: secret("GEMINI_KEY"),
  method: "POST",
});

const body = code(
  {
    $id: "make-body",
    $metadata: { title: "Make Request Body" },
    context: context,
  },
  {
    result: object({
      preMediaBlob: "string",
      media: imagePartType,
      postMediaBlob: "string",
    }),
  },
  ({ context }) => {
    const parts = context.at(0)?.parts;
    if (parts) {
      const inlineParts = parts?.filter((part) => "inlineData" in part);
      if (inlineParts && inlineParts.length > 0) {
        // Just send the first for now
        const first = inlineParts[0];
        if ("inlineData" in first) {
          const media: ConvertBreadboardType<typeof imagePartType> = first;
          const boundary = "BOUNDARY";
          const metadata = JSON.stringify({
            file: { display_name: "test prober" },
          });
          const preMediaBlob =
            "--" +
            boundary +
            "\r\n" +
            "Content-Type: application/json; charset=utf-8\r\n\r\n" +
            metadata +
            "\r\n--" +
            boundary +
            "\r\n" +
            "Content-Type: " +
            media.inlineData.mimeType +
            "\r\n\r\n";
          const postMediaBlob = "\r\n--" + boundary + "--";
          const result = {
            preMediaBlob,
            media,
            postMediaBlob,
          };
          return { result };
        }
      }
    }
    throw new Error("No image specified");
  }
).outputs.result;

const fetchResult = fetch({
  $id: "fetch-gemini-api",
  $metadata: { title: "Make API Call", description: "Calling Gemini File API" },
  method: "POST",
  url: constant(makeUrl),
  body,
  headers: {
    "Content-Type": "multipart/related; boundary=BOUNDARY",
    "X-Goog-Upload-Protocol": "multipart",
  },
});

const responseType = object({
  file: object({
    uri: "string",
    name: "string",
  }),
});

const response = unsafeCast(fetchResult.outputs.response, responseType);

const errorCollector = passthrough({
  $id: "collect-errors",
  $metadata: {
    title: "Collect Errors",
    description: "Collecting the error from Gemini API",
  },
  error: fetchResult.outputs.$error,
});

const errorLoopback = loopback({
  type: object({
    error: optional(
      object({
        code: optional("number"),
      })
    ),
  }),
});
errorLoopback.resolve(errorCollector.outputs.error);

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
    uri: {
      type: "string",
    },
  },
  ({ response }) => {
    const file = response;
    if (!file) {
      return {
        $error: `No file in response "${JSON.stringify(response)}" found`,
      };
    }
    console.log(response.file.uri);
    if ("uri" in response.file) {
      return { uri: response.file.uri };
    }
    return {
      $error: `No file in response "${JSON.stringify(response)}" found`,
    };
  }
);

export default board({
  title: "Gemini File API",
  description:
    "Updates the context from with uploaded files to Gemini File API",
  inputs: { context },
  outputs: {
    text: output(formattedResponse.outputs.uri, {
      title: "File URI",
      description: "The uploaded File URI",
    }),
  },
});

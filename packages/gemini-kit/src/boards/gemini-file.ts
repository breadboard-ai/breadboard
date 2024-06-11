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
  enumeration,
  input,
  loopback,
  object,
  optional,
  output,
  unsafeCast,
} from "@breadboard-ai/build";
import { DataCapability } from "@google-labs/breadboard";
import { ConvertBreadboardType } from "@breadboard-ai/build/internal/type-system/type.js";
import { code, fetch, passthrough, secret } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";

const textPartType = object({ text: "string" });

const imagePartType = object({
  inlineData: object({
    mimeType: "string",
    data: "string",
  }),
});

const storedDataPartType = object({
  storedData: object({
    mimeType: "string",
    handle: "string",
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
  storedDataPartType,
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
      media: anyOf(imagePartType, storedDataPartType),
      postMediaBlob: "string",
    }),
  },
  ({ context }) => {
    const parts = context.at(0)?.parts;
    if (parts) {
      const mediaParts = parts?.filter(
        (part) => "inlineData" in part || "storedData" in part
      );
      if (mediaParts && mediaParts.length > 0) {
        // Just send the first for now
        const boundary = "BOUNDARY";
        const preMedia =
          "--" +
          boundary +
          "\r\n" +
          "Content-Type: application/json; charset=utf-8\r\n\r\n{}\r\n--" +
          boundary +
          "\r\n" +
          "Content-Type: ";
        const postMediaBlob = `\r\n--${boundary}--`;
        const first = mediaParts[0];
        if ("storedData" in first) {
          const media: ConvertBreadboardType<typeof storedDataPartType> = first;
          const mimeType = media.storedData.mimeType;
          const preMediaBlob = `${preMedia}${mimeType}\r\n\r\n`;
          return { result: { preMediaBlob, media, postMediaBlob } };
        }
        if ("inlineData" in first) {
          const media: ConvertBreadboardType<typeof imagePartType> = first;
          const mimeType = media.inlineData.mimeType;
          const preMediaBlob = `${preMedia}${mimeType}\r\n\r\n`;
          return { result: { preMediaBlob, media, postMediaBlob } };
        }
      }
    }
    throw new Error("No media file specified");
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

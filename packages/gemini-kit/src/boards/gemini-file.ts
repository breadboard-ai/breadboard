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
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { create } from "domain";

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

type StoredPartType = {
  storedData: {
    mimeType: string;
    handle: string;
  };
};

type FileDataPartType = {
  fileData: {
    mimeType: string;
    file_uri: string;
  };
};

type PartType = TextPartType | ImagePartType | StoredPartType;

type MediaPartType = {
  contentIndex: number;
  partIndex: number;
  part: ImagePartType | StoredPartType | FileDataPartType;
};

type GenerateContentContentsType = {
  role: "model" | "user" | "$metadata";
  parts: PartType[];
};

const metadata = {
  title: "Gemini File Generator",
  description: "The board powered by the Gemini File API",
  version: "0.0.2",
} as GraphInlineMetadata;

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
  },
} satisfies Schema;

const textOutputSchema = {
  type: "object",
  properties: {
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

const createFileBodyBuilder = code(({ context }) => {
  const mediaPart = context as MediaPartType;
  if (mediaPart) {
    const boundary = "BOUNDARY";
    const preMediaFormat =
      "--" +
      boundary +
      "\r\n" +
      "Content-Type: application/json; charset=utf-8\r\n\r\n{}\r\n--" +
      boundary +
      "\r\n" +
      "Content-Type: ";
    const postMediaBlob = `\r\n--${boundary}--`;
    if ("storedData" in mediaPart.part) {
      const media = mediaPart.part as StoredDataCapabilityPart;
      const mimeType = media.storedData.mimeType;
      const preMediaBlob = `${preMediaFormat}${mimeType}\r\n\r\n`;
      return { result: { preMediaBlob, media, postMediaBlob } };
    }
    if ("inlineData" in mediaPart.part) {
      const media = mediaPart.part as InlineDataCapabilityPart;
      const mimeType = media.inlineData.mimeType;
      const preMediaBlob = `${preMediaFormat}${mimeType}\r\n\r\n`;
      return { result: { preMediaBlob, media, postMediaBlob } };
    }
  }
  const result: Record<string, unknown> = { mediaPart };

  return { result };
});

const fileResponseFormatter = code(({ inputPart, response }) => {
  type Response = { file: { uri: string; mimeType: string } } | undefined;
  const fileResponse = response as Response;
  const mediaPart = inputPart as MediaPartType;
  if (fileResponse && "file" in fileResponse) {
    const formattedPart = {
      part: {
        fileData: {
          file_uri: fileResponse.file.uri,
          mimeType: fileResponse.file.mimeType,
        },
      },
      contentIndex: mediaPart.contentIndex,
      partIndex: mediaPart.partIndex,
    } as MediaPartType;
    return { formattedPart };
  }
  throw new Error("Failed to get response from Gemini File API");
});

const fileBoardResponseFormatter = code(({ context, response }) => {
  type Content = { role?: string; parts: PartType[] };
  type FileResponseType = { part: MediaPartType };
  const responseParts = response as FileResponseType[];
  const contents = context as Content[];
  for (const part of responseParts) {
    const mediaPart = part.part as MediaPartType;
    contents[mediaPart.contentIndex].parts[mediaPart.partIndex] =
      mediaPart.part as PartType;
  }
  return { contents };
});

const filterMediaParts = code(({ context }) => {
  type Content = { role?: string; parts: PartType[] };
  let contents = context as Content[];
  const filteredParts = [];
  for (let cIdx = 0; cIdx < contents.length; cIdx++) {
    const parts = contents[cIdx].parts as PartType[];
    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
      if ("inlineData" in parts[pIdx] || "storedData" in parts[pIdx]) {
        const part = parts[pIdx] as ImagePartType | StoredPartType;
        const mediaPart = { contentIndex: cIdx, partIndex: pIdx, part };
        filteredParts.push(mediaPart);
      }
    }
  }
  return { filteredParts };
});

const createFileBoard = board(({ item }) => {
  const makeBody = createFileBodyBuilder({
    $id: "make-create-body",
    $metadata: { title: "Make CreateFile Request Body" },
    context: item,
  });

  const makeUrl = templates.urlTemplate({
    $id: "make-create-file-url",
    $metadata: {
      title: "Make File URL",
      description: "Creating the Gemini File API URL",
    },
    template:
      "https://generativelanguage.googleapis.com/upload/v1beta/files?key={GEMINI_KEY}",
    GEMINI_KEY: core.secrets({
      $id: "GEMINI_KEY-secret",
      keys: ["GEMINI_KEY"],
    }),
    method: "POST",
  });

  const fetch = core.fetch({
    $id: "fetch-create-file-api",
    $metadata: { title: "Call API", description: "Calling Create File API" },
    method: "POST",
    url: makeUrl.url.memoize(),
    body: makeBody.result,
    headers: {
      "Content-Type": "multipart/related; boundary=BOUNDARY",
      "X-Goog-Upload-Protocol": "multipart",
    },
  });

  const formatFileResponse = fileResponseFormatter({
    $id: "format-file-response",
    $metadata: {
      title: "Format File Response",
      description: "Formatting Gemini File API response",
    },
    inputPart: item,
    response: fetch.response,
  });

  return formatFileResponse.formattedPart.as("part").to(base.output({}));
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

  const filteredParts = filterMediaParts({
    $id: "filter-context",
    $metadata: {
      title: "Filter context for files to upload, if necessary",
      description: "Filtering context for files",
    },
    context: parameters,
  });

  const createFiles = core.map({
    $id: "create-files",
    $metadata: {
      title: "Upload the necessary files to Gemini File API",
      description: "Upload files",
    },
    list: filteredParts.filteredParts,
    board: createFileBoard,
  });

  const updatedContext = fileBoardResponseFormatter({
    $id: "combine-response",
    $metadata: {
      title: "Combine the response from uplaoded files",
      description: "Combine response from files",
    },
    context: parameters,
    response: createFiles.list,
  });

  return base.output({
    $id: "content-output",
    $metadata: { title: "Content Output", description: "Outputting content" },
    schema: textOutputSchema,
    context: updatedContext.contents,
  });
}).serialize(metadata);

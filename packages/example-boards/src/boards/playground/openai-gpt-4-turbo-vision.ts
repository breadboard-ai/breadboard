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
} from "@breadboard-ai/build";
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

const partType = anyOf(textPartType, imagePartType);

const generateContentContentsType = object({
  role: "string",
  parts: array(partType),
});

const content = input({
  $id: "Content",
  type: array(
    annotate(generateContentContentsType, {
      behavior: ["llm-content"],
    })
  ),
  title: "Context",
  description: "An array of messages to use as conversation context",
});

const fetchResult = fetch({
  $id: "openai",
  url: "https://api.openai.com/v1/chat/completions",
  method: "POST",
  headers: jsonata({
    $id: "makeHeaders",
    expression: `{
      "Content-Type": "application/json",
      "Authorization": "Bearer " & $.OPENAI_API_KEY
    }`,
    OPENAI_API_KEY: secret("OPENAI_API_KEY"),
  }).unsafeOutput("result"),
  body: jsonata({
    $id: "makeBody",
    expression: `{
      "model": "gpt-4-turbo",
      "messages": [
        {
            "role": "user",
            "content": $.content.parts.({
              "type": $exists($.text) ? "text" : "image_url",
              "text": $exists($.text) ? $.text : undefined,
              "image_url": $exists($.inlineData) ? {
                  "url": "data:" & $.inlineData.mimeType & ";base64," & $.inlineData.data
              } : undefined
            })
        }
      ],
      "stream": $.useStreaming,
      "temperature": 1,
      "max_tokens": 256,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0
    }`,
    content,
    useStreaming: false,
  }).unsafeOutput("result"),
});

const formattedResponse = jsonata({
  $id: "getResponse",
  expression: `choices[0].message.content`,
  json: fetchResult.outputs.response,
});

export default board({
  title: "OpenAI GPT-4 Turbo Vision",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT 4 Turbo API, using its vision capabilities to generate text from multipart inputs.",
  version: "0.1.0",
  inputs: { content },
  outputs: {
    text: output(formattedResponse.unsafeOutput("result")),
  },
});

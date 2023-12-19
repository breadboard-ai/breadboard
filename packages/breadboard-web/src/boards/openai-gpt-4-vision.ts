/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata, Schema, base, recipe } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { nursery } from "@google-labs/node-nursery-web";
import { chunkTransformer } from "./openai-chunk-transformer";

const metadata = {
  title: "OpenAI GPT 4 Vision Preview",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT 4 Vision Preview API to generate text from multipart inputs.",
  version: "0.0.2",
} satisfies GraphMetadata;

const inputSchema = {
  type: "object",
  properties: {
    content: {
      type: "array",
      title: "Content",
      format: "multipart",
    },
    useStreaming: {
      type: "boolean",
      title: "Stream",
      description: "Whether to stream the output",
      default: "false",
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
  const input = base.input({ $id: "input", schema: inputSchema });

  const textOutput = base.output({
    $id: "textOutput",
    schema: textOutputSchema,
  });

  const streamOutput = base.output({
    $id: "streamOutput",
    schema: streamOutputSchema,
  });

  const fetch = starter.fetch({
    $id: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    stream: input.useStreaming,
    headers: starter.jsonata({
      $id: "makeHeaders",
      expression: `{
        "Content-Type": "application/json",
        "Authorization": "Bearer " & $.OPENAI_API_KEY
      }`,
      OPENAI_API_KEY: starter.secrets({ keys: ["OPENAI_API_KEY"] }),
    }).result,
    body: input.to(
      starter.jsonata({
        $id: "makeBody",
        expression: `{
          "model": "gpt-4-vision-preview",
          "messages": [
            {
              "role": "user",
              "content": $.content.{
                "type": $keys($) = "text" ? "text" : "image_url" ,
                "text": $.text,
                "image_url": "data:" & $.inline_data.mime_type & ";base64," & $.inline_data.data
              }
            }
          ],
          "stream": $.useStreaming,
          "temperature": 1,
          "max_tokens": 256,
          "top_p": 1,
          "frequency_penalty": 0,
          "presence_penalty": 0
    }`,
      })
    ).result,
  });

  starter
    .jsonata({
      $id: "getResponse",
      expression: `choices[0].message.content`,
      json: fetch.response,
    })
    .result.as("text")
    .to(textOutput);

  return nursery
    .transformStream({
      board: chunkTransformer(),
      $id: "streamTransform",
      stream: fetch,
    })
    .to(streamOutput);
}).serialize(metadata);

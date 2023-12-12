/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Core } from "@google-labs/core-kit";
import { NodeNurseryWeb } from "@google-labs/node-nursery-web";

const board = new Board({
  title: "Gemini Pro Vision",
  description: "A simple example of using `gemini-pro-vision` model",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const core = board.addKit(Core);
const nursery = board.addKit(NodeNurseryWeb);

const parameters = board.input({
  $id: "parameters",
  schema: {
    type: "object",
    properties: {
      parts: {
        type: "array",
        format: "multipart",
        title: "Content",
        description: "Add content here",
        minItems: 1,
        items: [
          {
            type: "object",
            title: "Text",
            format: "text_part",
            description: "A text part, which consists of plain text",
            properties: {
              text: {
                type: "string",
              },
            },
          },
          {
            type: "object",
            title: "Image",
            format: "image_part",
            description: "An image part. Can be a JPEG or PNG image",
            properties: {
              mime_type: {
                type: "enum",
                enum: ["image/png", "image/jpeg"],
              },
              data: {
                type: "string",
              },
            },
          },
        ],
      },
    },
  } satisfies Schema,
});

const oauthCredentials = core.invoke({
  $id: "oauth",
  path: "oauth-config.local.json",
});

const headers = starter
  .jsonata({
    $id: "make-headers",
    expression:
      '{ "Authorization": "Bearer " & $.accessToken, "Accept": "application/json", "Content-Type": "application/json", "X-Goog-User-Project": $.projectId, "X-Google-Project-Override": "apiKey" }',
  })
  .wire(
    "<-projectId",
    core.passthrough({
      $id: "projectId",
      projectId: "google.com:breadboard-ai",
    })
  )
  .wire("<-accessToken", oauthCredentials);

const body = starter.jsonata({
  expression: `{ "contents": { "parts": $.parts }}`,
});

const fetch = starter
  .fetch({
    method: "POST",
    stream: true,
  })
  .wire("headers<-result", headers)
  .wire("<-body", body)
  .wire(
    "<-url",
    core.passthrough({
      url: "https://autopush-generativelanguage.sandbox.googleapis.com/v1beta/models/gemini-pro-vision:streamGenerateContent?alt=sse",
    })
  );

const chunkToText = nursery.transformStream((_, input, output) => {
  function run({
    chunk,
  }: {
    chunk: {
      candidates: {
        content: { parts: { text: string }[] };
      }[];
    };
  }): string {
    return chunk.candidates[0].content.parts[0].text;
  }

  input.wire(
    "chunk->",
    starter
      .runJavascript({
        code: run.toString(),
      })
      .wire("result->chunk", output)
  );
});

const output = board.output({
  schema: {
    properties: {
      stream: {
        type: "object",
        title: "Result",
        format: "stream",
      },
    },
  },
});

parameters.wire(
  "parts->",
  body.wire(
    "result->body",
    fetch
      .wire("headers<-results", headers)
      .wire("stream->", chunkToText.wire("stream->", output))
  )
);

export default board;

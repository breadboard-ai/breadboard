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
      useStreaming: {
        type: "boolean",
        title: "Stream",
        description: "Whether to stream the output",
        default: "false",
      },
    },
    required: ["parts"],
  } satisfies Schema,
});

const makeBody = starter.jsonata({
  $id: "makeBody",
  expression: `{ "contents": { "parts": $.parts }}`,
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

const makeUrl = starter
  .urlTemplate({
    $id: "makeURL",
    template:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:{method}?key={GEMINI_KEY}{+sseOption}",
  })
  .wire("<-GEMINI_KEY", starter.secrets({ keys: ["GEMINI_KEY"] }))
  .wire("<-method", chooseMethod)
  .wire("<-sseOption", chooseMethod);

const fetch = starter
  .fetch({
    method: "POST",
  })
  .wire("stream<-useStreaming", parameters)
  .wire("<-url", makeUrl)
  .wire(
    "$error->json",
    starter
      .jsonata({
        $id: "formatError",
        expression: "error.message",
      })
      .wire(
        "result->error",
        board.output({
          $id: "errorOutput",
          schema: {
            type: "object",
            properties: {
              error: {
                type: "string",
                title: "Error",
              },
            },
          } satisfies Schema,
        })
      )
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
  makeBody.wire(
    "result->body",
    fetch.wire("stream->", chunkToText.wire("stream->", output)).wire(
      "response->json",
      starter
        .jsonata({
          $id: "formatOutput",
          expression: "$join(candidates.content.parts.text)",
        })
        .wire(
          "result->",
          board.output({
            $id: "textOutput",
            schema: {
              type: "object",
              properties: {
                result: {
                  type: "string",
                  title: "Result",
                },
              },
            } satisfies Schema,
          })
        )
    )
  )
);

export default board;

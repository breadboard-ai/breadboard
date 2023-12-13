/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { NodeNurseryWeb } from "@google-labs/node-nursery-web";

const board = new Board({
  title: "OpenAI GPT 4 Vision Preview",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT 4 Vision Preview API to generate text from multipart inputs.",
  version: "0.0.2",
});
const starter = board.addKit(Starter);
const nursery = board.addKit(NodeNurseryWeb);

const input = board.input({
  $id: "input",
  schema: {
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
  },
});

const textOutput = board.output({
  $id: "textOutput",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Text",
        description: "The generated text",
      },
    },
  },
});

const streamOutput = board.output({
  $id: "streamOutput",
  schema: {
    type: "object",
    properties: {
      stream: {
        type: "object",
        title: "Stream",
        format: "stream",
        description: "The generated text",
      },
    },
  },
});

const makeHeaders = starter
  .jsonata({
    $id: "makeeHeaders",
    expression: `{
    "Content-Type": "application/json",
    "Authorization": "Bearer " & $.OPENAI_API_KEY
  }`,
  })
  .wire("<-OPENAI_API_KEY", starter.secrets({ keys: ["OPENAI_API_KEY"] }));

const makeBody = starter.jsonata({
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
});

const fetch = starter
  .fetch({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
  })
  .wire("stream<-useStreaming", input)
  .wire("headers<-result", makeHeaders);

const getResponse = starter.jsonata({
  $id: "getResponse",
  expression: `choices[0].message.content`,
});

const streamTransform = nursery.transformStream(
  (transformBoard, input, output) => {
    const starter = transformBoard.addKit(Starter);

    const transformCompletion = starter.jsonata({
      $id: "transformCompletion",
      expression: 'choices[0].delta.content ? choices[0].delta.content : ""',
    });

    input.wire(
      "chunk->json",
      transformCompletion.wire("result->chunk", output)
    );
  }
);

input.wire("useStreaming->", makeBody);
input.wire(
  "content->",
  makeBody.wire(
    "result->body",
    fetch
      .wire("response->json", getResponse.wire("result->text", textOutput))
      .wire("stream->", streamTransform.wire("stream->", streamOutput))
  )
);

export default board;

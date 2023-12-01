/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { NodeNurseryWeb } from "@google-labs/node-nursery-web";

const board = new Board({
  title: "OpenAI GPT-3.5-turbo",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT-3.5 API to generate text.",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const nursery = board.addKit(NodeNurseryWeb);

const input = board.input({
  $id: "input",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Text",
        description: "The text to generate",
      },
      useStreaming: {
        type: "boolean",
        title: "Stream",
        description: "Whether to stream the output",
        default: false,
      },
    },
  },
});

const textOutput = board.output({
  $id: "output",
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
  $id: "stream",
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

const headers = starter
  .jsonata({
    expression: `{
    "Content-Type": "application/json",
    "Authorization": "Bearer " & $
  }`,
  })
  .wire("json<-OPENAI_API_KEY", starter.secrets({ keys: ["OPENAI_API_KEY"] }));

const body = starter.jsonata({
  expression: `{
    "model": "gpt-3.5-turbo-1106",
    "messages": [
      {
        "role": "user",
        "content": $.text
      }
    ],
    "stream": $.useStreaming,
    "temperature": 1,
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
  .wire("headers<-result", headers);

const getResponse = starter.jsonata({
  expression: `choices[0].message.content`,
});

const streamTransform = nursery.transformStream(
  (transformBoard, input, output) => {
    const starter = transformBoard.addKit(Starter);

    const transformCompletion = starter.jsonata({
      expression: 'choices[0].delta.content ? choices[0].delta.content : ""',
    });

    input.wire(
      "chunk->json",
      transformCompletion.wire("result->chunk", output)
    );
  }
);

input.wire("useStreaming->", body);
input.wire(
  "text->",
  body.wire(
    "result->body",
    fetch
      .wire("response->json", getResponse.wire("result->text", textOutput))
      .wire("stream->", streamTransform.wire("stream->", streamOutput))
  )
);

export default board;

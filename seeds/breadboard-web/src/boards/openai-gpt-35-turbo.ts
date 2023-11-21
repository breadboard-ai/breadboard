/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "OpenAI GPT-3.5-turbo",
  description:
    "This board is the simplest possible invocation of OpenAI's GPT-3.5 API to generate text.",
  version: "0.0.1",
});
const starter = board.addKit(Starter);

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
    },
  },
});

const output = board.output({
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
        "content": $
      }
    ],
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
  .wire("headers<-result", headers);

const getResponse = starter.jsonata({
  expression: `choices[0].message.content`,
});

input.wire(
  "text->json",
  body.wire(
    "result->body",
    fetch.wire("response->json", getResponse.wire("result->text", output))
  )
);

export default board;

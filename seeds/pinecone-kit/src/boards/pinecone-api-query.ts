/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "Pinecone API query invocation",
  description:
    "This board invokes the Pinecone [`query`](https://docs.pinecone.io/reference/query) API.",
  version: "0.0.1",
});

const starter = board.addKit(Starter);

// TODO: Make topK and other properties configurable.
const body = starter.jsonata(
  '{ "vector": $, "topK": 10, "includeMetadata": true }',
  {
    $id: "make-body",
  }
);

const apiCall = board
  .include("pinecone-vector-api.json", { $id: "pinecone-api-call" })
  .wire("<-call", board.passthrough({ $id: "query-api", call: "query" }))
  .wire("<-config", board.include("pinecone-api-config.json"));

board
  .input({
    $id: "query",
    schema: {
      type: "object",
      properties: {
        embedding: {
          type: "array",
          title: "Embedding",
          description: "The embedding to query -- an array of floats",
          items: {
            type: "number",
          },
        },
      },
    },
  })
  .wire(
    "embedding->json",
    body.wire(
      "result->body",
      apiCall.wire("response->", board.output({ $id: "response" }))
    )
  );

export default board;

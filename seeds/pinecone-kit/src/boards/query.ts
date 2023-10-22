/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Core } from "@google-labs/core-kit";

const board = new Board({
  title: "Pinecone API query invocation",
  description:
    "This board invokes the Pinecone [`query`](https://docs.pinecone.io/reference/query) API.",
  version: "0.0.1",
});

const starter = board.addKit(Starter);
const core = board.addKit(Core);

// TODO: Make topK and other properties configurable.
const body = starter.jsonata(
  '{ "vector": $, "topK": 10, "includeMetadata": true }',
  {
    $id: "make-body",
  }
);

const apiCall = core
  .include({ $id: "vector", $ref: "#vector" })
  .wire("<-call", core.passthrough({ $id: "query-api", call: "query" }))
  .wire("<-config", core.include({ $id: "config", $ref: "#config" }));

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

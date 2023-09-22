/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

const board = new Board({
  title: "Pinecone API upsert invocation",
  description:
    "This board invokes the Pinecone [`vectors/upsert`](https://docs.pinecone.io/reference/upsert) API.",
  version: "0.0.1",
});

const apiCall = board
  .include("pinecone-vector-api.json", { $id: "pinecone-api-call" })
  .wire("<-call", board.passthrough({ $id: "upsert", call: "vectors/upsert" }))
  .wire("<-config", board.include("pinecone-api-config.json"));

board
  .input({
    $id: "vectors",
    schema: {
      type: "object",
      title: "The body of the API call",
      properties: {
        vectors: {
          type: "object",
          title: "Vectors",
          description: "The body of the API call",
          properties: {
            vectors: {
              type: "array",
              title: "Vectors",
              description:
                "The vectors to upsert -- an array of objects with `id`, `values` and `metadata` properties",
              items: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    title: "ID",
                    description: "The ID of the vector",
                  },
                  values: {
                    type: "array",
                    title: "Values",
                    description: "The vector: a list of floats",
                    items: {
                      type: "number",
                    },
                  },
                  metadata: {
                    type: "object",
                    title: "Metadata",
                    description: "The metadata associated with the vector",
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  .wire("vectors->body", apiCall.wire("response->", board.output()));

export default board;

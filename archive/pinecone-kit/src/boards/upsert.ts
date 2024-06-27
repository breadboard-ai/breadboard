/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";

const board = new Board({
  title: "Pinecone API upsert invocation",
  description:
    "This board invokes the Pinecone [`vectors/upsert`](https://docs.pinecone.io/reference/upsert) API.",
  version: "0.0.1",
});
const core = board.addKit(Core);

const apiCall = core
  .include({ $id: "vector", $ref: "#vector" })
  .wire("<-call", core.passthrough({ $id: "upsert", call: "vectors/upsert" }))
  .wire("<-config", core.include({ $id: "config", $ref: "#config" }));

board
  .input({
    $id: "vectors",
    schema: {
      type: "object",
      title: "The body of the API call",
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
  })
  .wire("vectors->body", apiCall.wire("response->", board.output()));

export default board;

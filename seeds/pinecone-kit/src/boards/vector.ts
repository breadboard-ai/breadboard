/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "Pinecone API vector call builder",
  description:
    "This board helps making [vector API calls](https://docs.pinecone.io/reference/describe_index_stats_post) to Pinecone.",
  version: "0.0.1",
});

const starter = board.addKit(Starter);

const api = board.input({
  $id: "api",
  schema: {
    type: "object",
    properties: {
      api: {
        type: "string",
        title: "API call",
        description: "The API call to make",
      },
      body: {
        type: "object",
        title: "Body",
        description: "The body of the API call",
      },
      config: {
        type: "object",
        title: "Pinecone API configuration",
        description:
          "The Pinecone API configuration, as returned by the `pinecone-api-config` board",
        properties: {
          PINECONE_INDEX: {
            type: "string",
            title: "Pinecone index",
            description: "The name of the Pinecone index to use",
          },
          PINECONE_PROJECT_ID: {
            type: "string",
            title: "Pinecone project ID",
            description: "The ID of the Pinecone project to use",
          },
          PINECONE_ENVIRONMENT: {
            type: "string",
            title: "Pinecone environment",
            description: "The Pinecone environment to use",
          },
          PINECONE_API_KEY: {
            type: "string",
            title: "Pinecone API key",
            description: "The Pinecone API key to use",
          },
        },
        required: [
          "PINECONE_ENVIRONMENT",
          "PINECONE_API_KEY",
          "PINECONE_INDEX",
          "PINECONE_PROJECT_ID",
        ],
      },
    },
    required: ["api"],
  },
});

const config = starter
  .jsonata({
    expression: "config",
    $id: "config",
    raw: true,
  })
  .wire("<-config", api);

const headers = starter
  .jsonata({
    expression:
      "{ \"Api-Key\": $, \"Accept\": \"application/json\", \"Content-Type\": \"application/json\" }",
    $id: "make-headers",
  })
  .wire("json<-PINECONE_API_KEY", config);

starter
  .fetch({
    $id: "pinecone-api-call",
    method: "POST",
  })
  .wire("headers<-result", headers)
  .wire(
    "<-url",
    starter
      .urlTemplate({
        $id: "make-pinecone-url",
        template: "https://{PINECONE_INDEX}-{PINECONE_PROJECT_ID}.svc.{PINECONE_ENVIRONMENT}.pinecone.io/{+call}",
      })
      .wire("<-PINECONE_INDEX", config)
      .wire("<-PINECONE_PROJECT_ID", config)
      .wire("<-PINECONE_ENVIRONMENT", config)
      .wire("<-call", api)
  )
  .wire("<-body", api)
  .wire("response->", board.output({ $id: "response" }));

export default board;

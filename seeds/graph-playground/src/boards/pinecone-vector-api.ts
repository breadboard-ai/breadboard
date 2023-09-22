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
    },
    required: ["api"],
  },
});

const headers = starter
  .jsonata(
    '{ "Api-Key": $, "Accept": "application/json", "Content-Type": "application/json" }',
    { $id: "make-headers" }
  )
  .wire("json<-PINECONE_API_KEY", starter.secrets(["PINECONE_API_KEY"]));

starter
  .fetch(false, {
    $id: "pinecone-api-call",
    method: "POST",
  })
  .wire("headers<-result", headers)
  .wire(
    "url<-prompt",
    starter
      .promptTemplate(
        "https://{{PINECONE_INDEX}}-{{PINECONE_PROJECT_ID}}.svc.{{PINECONE_ENVIRONMENT}}.pinecone.io/{{call}}",
        {
          $id: "make-pinecone-url",
        }
      )
      .wire("<-PINECONE_INDEX", starter.secrets(["PINECONE_INDEX"]))
      .wire("<-PINECONE_PROJECT_ID", starter.secrets(["PINECONE_PROJECT_ID"]))
      .wire("<-PINECONE_ENVIRONMENT", starter.secrets(["PINECONE_ENVIRONMENT"]))
      .wire("<-call", api)
  )
  .wire("<-body", api)
  .wire("response->", board.output({ $id: "response" }));

export default board;

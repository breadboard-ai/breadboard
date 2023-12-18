/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "Pinecone API configuration helper",
  description:
    "Loads the Pinecone API key and other necessary variables from the environment. Currently looks for the following environment variables: `PINECONE_API_KEY`, `PINECONE_INDEX`, `PINECONE_PROJECT_ID`, `PINECONE_ENVIRONMENT`.",
  version: "0.0.1",
});

const starter = board.addKit(Starter);

starter
  .jsonata({
    expression: "$",
    $id: "start",
  })
  .wire("<-PINECONE_INDEX", starter.secrets({ keys: ["PINECONE_INDEX"] }))
  .wire("<-PINECONE_PROJECT_ID", starter.secrets({ keys: ["PINECONE_PROJECT_ID"] }))
  .wire("<-PINECONE_ENVIRONMENT", starter.secrets({ keys: ["PINECONE_ENVIRONMENT"] }))
  .wire("<-PINECONE_API_KEY", starter.secrets({ keys: ["PINECONE_API_KEY"] }))
  .wire(
    "result->config",
    board.output({
      $id: "result",
      schema: {
        type: "object",
        properties: {
          config: {
            type: "object",
            title: "Pinecone API configuration",
            description: "The Pinecone API configuration",
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
            required: ["PINECONE_ENVIRONMENT", "PINECONE_API_KEY"],
          },
        },
        reqired: ["config"],
      },
    })
  );

export default board;

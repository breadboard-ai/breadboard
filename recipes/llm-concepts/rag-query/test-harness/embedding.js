/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, recipe, code } from "@google-labs/breadboard";

const metaData = {
  title: "Generate an embedding",
  description:
    "Generates an embedding using PaLM, but can be used with any embedding provider (if the 'provider' is specified.)",
  version: "0.0.3",
};

const embeddingScheme = {
  type: "object",
  properties: {
    query: {
      type: "string",
      title: "input",
      description: "What text is used to generate the embedding?",
    },
  },
  required: ["query"],
};

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: embeddingScheme });

  const embeddingNode = code(({ query }) => {
    console.log("query", query);
    if (query === undefined || query == ".") {
      throw new Error("query is undefined");
    }
    return { embedding: [1, 2, 3] };
  });

  return input.query
    .to(embeddingNode())
    .embedding.to(base.output({ $id: "embedding_result" }));
}).serialize(metaData);

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, recipe, code } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { core } from "@google-labs/core-kit";

const metaData = {
  title: "Convert String to JSON",
  description: "Converts a string to JSON.",
  version: "0.0.3",
};

const inputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      title: "Query",
      description: "Query",
    },
    ragBoardPath: {
      type: "string",
      title: "string",
      description:
        "Location of the board that will retrieve the additional context (RAG)",
    },
    embeddingBoardPath: {
      type: "string",
      title: "string",
      description: "Location of the board that will generate the embedding",
    },
    generateTextBoardPath: {
      type: "string",
      title: "string",
      description: "Location of the board that will generate the response",
    },
  },
  required: ["query", "ragBoardPath", "embeddingBoardPath"],
};

const outputSchema = {
  type: "object",
  properties: {
    response: {
      type: "string",
      title: "Response",
      description: "Response",
    },
  },
};

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: inputSchema });

  const generateQueryEmbedding = core.invoke({
    $id: "generateQueryEmbedding",
    path: input.embeddingBoardPath,
    query: input.query,
  });

  // We are expecting dataStore to
  const retrieveCandidateFromDataStore = core.invoke({
    $id: "retrieveCandidateFromDataStore",
    path: input.ragBoardPath,
    embedding: generateQueryEmbedding.embedding,
  });

  const prompt = starter.promptTemplate({
    template: `Answer the question as truthfully as possible using the provided context, and if don't have the answer, say "I don't know" and suggest looking for this information elsewhere.
    
Context: {{candidate}}
  
Question: {{query}}
  
Answer:`,
  });

  prompt.in({
    query: input.query,
    candidate: retrieveCandidateFromDataStore.candidate,
  });

  return prompt.text
    .to(core.invoke({ $id: "generateText", path: input.generateTextBoardPath }))
    .text.to(base.output({ $id: "output", schema: outputSchema }));
}).serialize(metaData);

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";

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
      description:
        "Location of the board that will generate the embedding that wil be used by the RAG board to retrieve the most appropriate context",
    },
    generateTextBoardPath: {
      type: "string",
      title: "string",
      description:
        "Location of the board that will generate the response to the prompt that is generated from the query and the retrieved context",
    },
  },
  required: [
    "query",
    "ragBoardPath",
    "embeddingBoardPath",
    "generateTextBoardPath",
  ],
};

const outputSchema = {
  type: "object",
  properties: {
    text: {
      type: "string",
      title: "Response",
      description: "Response",
    },
  },
};

export default await board(() => {
  const input = base.input({ $id: "input", schema: inputSchema });

  const generateQueryEmbedding = core.invoke({
    $id: "generateEmbedding",
    path: input.embeddingBoardPath,
    query: input.query,
  });

  // We are expecting dataStore to
  const retrieveCandidateContext = core.invoke({
    $id: "retrieveCandidateContext",
    path: input.ragBoardPath,
    embedding: generateQueryEmbedding.embedding,
  });

  const prompt = templates.promptTemplate({
    template: `Answer the question as truthfully as possible using the provided context, and if don't have the answer, say "I don't know" and suggest looking for this information elsewhere.

Context: {{candidate}}

Question: {{query}}

Answer:`,
  });

  const getBestCandidate = code(({ candidates }) => {
    // This is a very naieve implementation, but it will do for now.
    return { candidate: candidates[0] };
  });

  prompt.in({
    query: input.query,
    candidate: retrieveCandidateContext.candidates.to(
      getBestCandidate({ $id: "getBestCandidate" })
    ),
  });

  return prompt.text
    .to(core.invoke({ $id: "generateText", path: input.generateTextBoardPath }))
    .text.to(base.output({ $id: "output", schema: outputSchema }));
}).serialize(metaData);

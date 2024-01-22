/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Pinecone } from "@google-labs/pinecone-kit";
import { PaLMKit } from "@google-labs/palm-kit";
import JSONKit from "@google-labs/json-kit";

const board = new Board({
  title: "Retrieval-augmented generation with Pinecone",
  description:
    "This board implements the simplest possible retrieval-augmented generation (RAG) system using Pinecone store. The store was generated with [pinecone-load](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/graphs/pinecone-load.json).",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const pinecone = board.addKit(Pinecone);
const palm = board.addKit(PaLMKit);
const json = board.addKit(JSONKit);

const template = starter.promptTemplate({
  template: `
Analyze the question and the knowledge base, provided below.

If the knowledge base does not contain the information to produce the answer, tell the user that you don't know.

Otherwise, write a comprehensive answer to the question using only the information from the knowledge base.

# Question:

{{query}}

# Knowledge Base:
{{context}}

# Answer
`,
});

board
  .input({
    $id: "query",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Question",
          description: "Ask small corpus a question",
        },
      },
    },
  })
  .wire(
    "text->",
    palm
      .embedText()
      .wire("<-PALM_KEY", starter.secrets({ keys: ["PALM_KEY"] }))
      .wire(
        "embedding->",
        pinecone
          .query()
          .wire(
            "response->json",
            json
              .jsonata({ expression: "$join(matches.metadata.text, '\n\n')" })
              .wire("result->context", template)
          )
      )
  )
  .wire("text->query", template);

template.wire(
  "prompt->text",
  palm
    .generateText()
    .wire("<-PALM_KEY", starter.secrets({ keys: ["PALM_KEY"] }))
    .wire("completion->text", board.output({ $id: "rag" }))
);

export default board;

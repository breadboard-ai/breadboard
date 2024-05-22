/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

const metadata = {
  title: "JSON Agent",
  description: "A simple example of wrapping the Structured Worker node.",
  version: "0.0.3",
};

const sampleInstruction = `You are building a team of skilled experts to create high quality rhyming poems that will be used as lyrics for jingles in TV commercials. These experts can only read text and produce text. Creating melodies and producing music is not their responsibility. The experts will work as a team, collaborating, creating, reviewing, critiquing, and iteratively improving the quality of the poems.

Please identify the necessary job descriptions of these experts.`;

const sampleSchema = JSON.stringify(
  {
    type: "object",
    properties: {
      descriptions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "expert's title",
            },
            responsibilities: {
              type: "array",
              items: {
                type: "string",
                description: "expert's responsibilities",
              },
            },
          },
        },
      },
    },
  } satisfies Schema,
  null,
  2
);

export default await board(({ instruction, schema, context }) => {
  instruction
    .title("Instruction")
    .examples(sampleInstruction)
    .format("multiline");
  schema
    .title("Schema")
    .examples(sampleSchema)
    .isObject()
    .behavior("json-schema")
    .optional()
    .default("{}");

  context.title("Context").isArray().behavior("llm-content").examples("[]");

  const structuredWorker = agents.structuredWorker({
    $id: "structuredWorker",
    context,
    instruction,
    schema,
  });

  return { context: structuredWorker.context, json: structuredWorker.json };
}).serialize(metadata);

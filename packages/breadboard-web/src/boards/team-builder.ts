/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

const metadata = {
  title: "Team Builder",
  description: "Build a team of experts",
  version: "0.0.1",
};

const jobDescriptionsSchema = {
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
} satisfies Schema;

export default await recipe(({ purpose, generator }) => {
  purpose
    .title("Purpose")
    .examples(
      "Create high quality rhyming poems that will be used as lyrics for jingles in TV commercials. Creating melodies and producing music is not part of job."
    )
    .format("multiline");
  generator.title("Generator").examples("gemini-generator.json");

  const jobDescriptions = core.invoke({
    $id: "jobDescriptions",
    path: "json-agent.json",
    schema: jobDescriptionsSchema,
    context: [],
    generator,
    text: starter.promptTemplate({
      $id: "jobDescriptionsPrompt",
      template: `You are building a team of expert LLM-based agents for the following purpose:
      
{{purpose}}

These expert agents can only read text and produce text. The experts will work as a team, collaborating, creating, reviewing, critiquing, and iteratively improving the quality of the poems.

Please identify the necessary job descriptions of these experts.`,
      purpose,
    }).prompt,
  });

  return { text: jobDescriptions.json };
}).serialize(metadata);

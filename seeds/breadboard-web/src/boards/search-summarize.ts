/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { palm } from "@google-labs/palm-kit";

const input = base.input({
  $id: "input",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Query",
        description: "What would you like to search for?",
      },
    },
    required: ["text"],
  },
});

const searchURLTemplate = starter.urlTemplate({
  template:
    "https://www.googleapis.com/customsearch/v1?key={API_KEY}&cx={GOOGLE_CSE_ID}&q={query}",
  query: input.text,
  API_KEY: starter.secrets({ keys: ["API_KEY"] }).API_KEY,
  GOOGLE_CSE_ID: starter.secrets({ keys: ["GOOGLE_CSE_ID"] }).GOOGLE_CSE_ID,
});

const search = starter.fetch({ url: searchURLTemplate.url });
const results = starter.jsonata({
  expression: "$join(items.snippet, '\n')",
  json: search.response,
});

const summarizingTemplate = starter.promptTemplate({
  template:
    "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
  question: input.text,
  context: results.result,
  $id: "summarizing-template",
});

const generateSummary = palm.generateText({
  text: summarizingTemplate.prompt,
  PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
});

const output = base.output({
  text: generateSummary.completion,
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Answer",
        description: "The answer to the query",
      },
    },
    required: ["text"],
  },
});

export const graph = output;

export const example = "What is the meaning of life?";

export default await graph.serialize({
  title: "New: The Search Summarizer Recipe",
  description:
    "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",
  version: "0.0.2",
});

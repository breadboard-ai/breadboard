/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, llm } from "../../new/kits.js";

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

const searchURLTemplate = llm.urlTemplate({
  template:
    "https://www.googleapis.com/customsearch/v1?key={API_KEY}&cx={GOOGLE_CSE_ID}&q={query}",
  query: input.text,
  API_KEY: llm.secrets({ keys: ["API_KEY"] }).API_KEY,
  GOOGLE_CSE_ID: llm.secrets({ keys: ["GOOGLE_CSE_ID"] }).GOOGLE_CSE_ID,
});

const search = llm.fetch({ url: searchURLTemplate.url });
const results = llm.jsonata({
  expression: "$join(items.snippet, '\n')",
  json: search.response,
});

const summarizingTemplate = llm.promptTemplate({
  template:
    "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
  question: input.text,
  context: results.result,
  $id: "summarizing-template",
});

const generateSummary = llm.generateText({
  text: summarizingTemplate.prompt,
  PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
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

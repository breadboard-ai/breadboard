/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, board, input, object, output } from "@breadboard-ai/build";
import { fetch, invoke, secret } from "@google-labs/core-kit";
import { promptTemplate, urlTemplate } from "@google-labs/template-kit";
import { jsonata } from "@google-labs/json-kit";

const query = input({
  type: "string",
  title: "Query",
  description: "What would you like to search for?",
});

const generator = input({
  $id: "text-generator",
  title: "Generator",
  type: annotate(object({}), {
    behavior: ["board"],
  }),
  description: "The URL of the generator to call",
  default: { kind: "board", path: "text-generator.json" }
});

const apiKey = secret("API_KEY");
const cseId = secret("GOOGLE_CSE_ID");

const url = urlTemplate({
  $id: "customSearchURL",
  $metadata: {
    title: "CSE URL Template",
  },
  template:
    "https://www.googleapis.com/customsearch/v1?key={API_KEY}&cx={GOOGLE_CSE_ID}&q={query}",
  query,
  API_KEY: apiKey,
  GOOGLE_CSE_ID: cseId
});

const fetchResult = fetch({
  $id: "search",
  url
});

const snippets = jsonata({
  $id: "getSnippets",
  expression: "$join(items.snippet, '\n')",
  json: fetchResult.outputs.response
}).unsafeOutput("result");

const prompt = promptTemplate({
  $id: "summarizing-template",
  template: "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
  question: query,
  context: snippets
});

const llmResponse = invoke({
  $id: "llm-response",
  $board: generator,
  text: prompt
}).unsafeOutput("text");

export default board({
  title: "The Search Summarizer Board",
  description: "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",
  version: "0.2.0",
  inputs: { query, generator },
  outputs: { result: output(llmResponse) },
});

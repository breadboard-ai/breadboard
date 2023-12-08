/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

const searchSummarize = new Board({
  title: "The Search Summarizer Recipe",
  description:
    "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",
  version: "0.1.0",
});
const kit = searchSummarize.addKit(Starter);
const core = searchSummarize.addKit(Core);

const input = searchSummarize.input({
  $id: "input",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Query",
        description: "What would you like to search for?",
      },
      generator: {
        type: "string",
        title: "Generator",
        description: "The URL of the generator to call",
        default: "/graphs/text-generator.json",
      },
    },
    required: ["text"],
  },
});

const output = searchSummarize.output({
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

const generator = core.invoke({ $id: "generator" }).wire("text->", output);

const summarizingTemplate = kit
  .promptTemplate({
    template:
      "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
    $id: "summarizing-template",
  })
  .wire("prompt->text", generator);

const searchURLTemplate = kit
  .urlTemplate({
    template:
      "https://www.googleapis.com/customsearch/v1?key={API_KEY}&cx={GOOGLE_CSE_ID}&q={query}",
  })
  .wire(
    "url",
    kit
      .fetch()
      .wire(
        "response->json",
        kit
          .jsonata({ expression: "$join(items.snippet, '\n')" })
          .wire("result->context", summarizingTemplate)
      )
  );

kit
  .secrets({ keys: ["API_KEY", "GOOGLE_CSE_ID"] })
  .wire("API_KEY", searchURLTemplate)
  .wire("GOOGLE_CSE_ID", searchURLTemplate);

input
  .wire("generator->path", generator)
  .wire("text->question", summarizingTemplate)
  .wire("text->query", searchURLTemplate);

export default searchSummarize;

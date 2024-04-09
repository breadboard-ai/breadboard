/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata, Schema, V, base, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";
import { json } from "@google-labs/json-kit";

const metadata = {
  title: "The Search Summarizer Board",
  description:
    "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",
  version: "0.1.1",
} satisfies GraphMetadata;

const inputSchema = {
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
      default: "text-generator.json",
    },
  },
  required: ["text"],
} satisfies Schema;

const outputSchema = {
  type: "object",
  properties: {
    text: {
      type: "string",
      title: "Answer",
      description: "The answer to the query",
    },
  },
  required: ["text"],
} satisfies Schema;

export default await board(() => {
  const parameters = base.input({ $id: "parameters", schema: inputSchema });

  return core
    .secrets({ keys: ["API_KEY", "GOOGLE_CSE_ID"] })
    .to(
      templates.urlTemplate({
        $id: "customSearchURL",
        template:
          "https://www.googleapis.com/customsearch/v1?key={API_KEY}&cx={GOOGLE_CSE_ID}&q={query}",
        query: parameters.text,
      })
    )
    .url.to(core.fetch({ $id: "search" }))
    .response.as("json")
    .to(
      json.jsonata({
        $id: "getSnippets",
        expression: "$join(items.snippet, '\n')",
      })
    )
    .result.as("context")
    .to(
      templates.promptTemplate({
        template:
          "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
        $id: "summarizing-template",
        question: parameters.text,
      })
    )
    .prompt.as("text")
    .to(
      core.invoke({
        $id: "generator",
        $board: parameters.generator as V<string>,
      })
    )
    .text.to(base.output({ schema: outputSchema }));
}).serialize(metadata);

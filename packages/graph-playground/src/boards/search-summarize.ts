/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import { TemplateKit } from "@google-labs/template-kit";
import { PaLMKit } from "@google-labs/palm-kit";

const searchSummarize = new Board({
  title: "The Search Summarizer Recipe",
  description:
    "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",
  version: "0.0.1",
});
const kit = searchSummarize.addKit(TemplateKit);
const core = searchSummarize.addKit(Core);
const palm = searchSummarize.addKit(PaLMKit);
const json = searchSummarize.addKit(JSONKit);

const completion = palm.generateText().wire(
  "completion->text",
  searchSummarize.output({
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
  })
);

const summarizingTemplate = kit
  .promptTemplate({
    template:
      "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
    $id: "summarizing-template",
  })
  .wire("prompt->text", completion);

const searchURLTemplate = kit
  .urlTemplate({
    template:
      "https://www.googleapis.com/customsearch/v1?key={API_KEY}&cx={GOOGLE_CSE_ID}&q={query}",
  })
  .wire(
    "url",
    core
      .fetch()
      .wire(
        "response->json",
        json
          .jsonata({ expression: "$join(items.snippet, '\n')" })
          .wire("result->context", summarizingTemplate)
      )
  );

core
  .secrets({ keys: ["PALM_KEY", "API_KEY", "GOOGLE_CSE_ID"] })
  .wire("PALM_KEY", completion)
  .wire("API_KEY", searchURLTemplate)
  .wire("GOOGLE_CSE_ID", searchURLTemplate);

searchSummarize
  .input({
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
  })
  .wire("text->question", summarizingTemplate)
  .wire("text->query", searchURLTemplate);

export default searchSummarize;

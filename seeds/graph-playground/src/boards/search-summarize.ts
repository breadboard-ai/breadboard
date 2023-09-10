/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const searchSummarize = new Board();
const kit = searchSummarize.addKit(Starter);

const completion = kit
  .generateText()
  .wire("completion->text", searchSummarize.output());

const summarizingTemplate = kit
  .promptTemplate(
    "Use context below to answer this question:\n\n##Question:\n{{question}}\n\n## Context {{context}}\n\\n## Answer:\n",
    { $id: "summarizing-template" }
  )
  .wire("prompt->text", completion);

const searchURLTemplate = kit
  .urlTemplate(
    "https://www.googleapis.com/customsearch/v1?key={{PALM_KEY}}&cx={{GOOGLE_CSE_ID}}&q={{query}}"
  )
  .wire(
    "url",
    kit
      .fetch()
      .wire(
        "response->json",
        kit
          .jsonata("$join(items.snippet, '\n')")
          .wire("result->context", summarizingTemplate)
      )
  );

kit
  .secrets(["PALM_KEY", "GOOGLE_CSE_ID"])
  .wire("PALM_KEY", completion)
  .wire("PALM_KEY", searchURLTemplate)
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

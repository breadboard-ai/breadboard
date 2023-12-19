/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";

const board = new Board({
  title: "Inferring a query for the RAG pattern",
  description:
    "This board is a prototype to infer the query from the original prompt for  retrieval-augmented generation (RAG). The basic idea is that the user provides a template with a placeholder for the retrieved data, and the query to retrieve this data is inferred from the template itself.",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const palm = board.addKit(PaLMKit);

const askForTemplate = board.input({
  $id: "askForTemplate",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Template",
        format: "multiline",
        description:
          "Provide the text of the template, using {{context}} to specify location of context to be retrieved.",
      },
    },
  },
});

const printResults = board.output({
  $id: "printResults",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Result",
        description: "The final result of RAG with inferrred query.",
      },
    },
  },
});

const contextPlaceholder = "CONTEXT GOES HERE";

const promptToInfer = starter.promptTemplate({
  $id: "promptToInfer",
  template: undefined,
  context: `\n\n${contextPlaceholder}\n\n`,
});

const inferringPrompt = starter.promptTemplate({
  $id: "inferringPrompt",
  template: `
The JSON below represents a prompt that the user wants to populate with more context to better answer questions within the prompt. The context will supplied by a search engine and will be inserted in place of the "${contextPlaceholder}" placeholder.

Your job is to analyze the prompt and summarize all of the information within it, then formulate a query that would allow retrieving the relevant context from a search engine.

Reply as valid JSON in the following format:
{
  "summary: [
    "the list of points in the prompt that will be used to formulate the query"
  ]
  "query": "the detailed, comprehensive query that may consist of several questions"
}

JSON:
{{result}}

Question:`
});

const promptStuffer = starter.jsonata({
  expression: "{ \"prompt\": $ }",
  $id: "promptStuffer",
});

const questionGenerator = palm.generateText({ $id: "questionGenerator" });

askForTemplate.wire(
  "text->template",
  promptToInfer.wire(
    "prompt->json",
    promptStuffer.wire(
      "result->",
      inferringPrompt.wire(
        "prompt->text",
        questionGenerator
          .wire("completion->text", printResults)
          .wire("<-PALM_KEY", starter.secrets({ keys: ["PALM_KEY"] })),
      )
    )
  )
);

export default board;

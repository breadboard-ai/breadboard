/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

const superDenseText =
  "In one aspect, a system is described to include computer data servers each storing and operable to serve a partition of a collection of data. The respective partitions together constitute the collection of data and each respective partition is less than the collection of data. This system also includes a processing server operable to obtain data from the data servers and to use the obtained data to process an input and to produce an output. The system can be implemented to include one or more replica data servers for each of the data servers. In one implementation, the collection of data is data for a language model for a target language. The language model includes n grams in the target language and statistical data for each of the n grams. The n grams can include N-grams with N greater than 3. The processing server is a translation server operable to translate a text in a source language in the input into the target language using the obtained data from the language model. The processing server can be implemented in various configurations, e.g., a speech recognition server operable to convert a human speech in the target language in the input into a text in the target language using the obtained data from the language model, a spelling correction server operable to correct a spelling of a word in the target language in the input using the obtained data from the language model, or an optical character recognition server operable to recognize text in a received document image in the input using the obtained data from the language model.";

export default await board(({ context }) => {
  context
    .title("Text to summarize")
    .isString()
    .examples(superDenseText)
    .format("multiline");
  const summarizer = agents.structuredWorker({
    $id: "summarizer",
    context,
    instruction:
      "You are a genius legal expert. You specialize in carefully reading the dense paragraphs of patent application texts and summarizing them in a few simple sentences that most people can understand. Incorporate all improvements, if they are suggested",
    schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "the summary",
        },
      },
    } satisfies Schema,
  });
  const critic = agents.structuredWorker({
    $id: "critic",
    context: summarizer.context,
    instruction:
      "You are a reviewer of summaries produced from patent applications, helping to make the summaries become more accessible and clear. Compare the latest summary with the original text and identify three areas of improvement. What is missing? What could be better phrased? What could be removed? Is there any technical jargon that could be replaced with simpler terms?",
    schema: {
      type: "object",
      properties: {
        improvements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              improvement: {
                type: "string",
                description: "a suggested improvement",
              },
              reasoning: {
                type: "string",
                description: "reasoning behind the improvement",
              },
            },
          },
        },
      },
    } satisfies Schema,
  });
  return { context: critic.context, json: critic.json };
}).serialize({
  title: "Dense text summarizer (single iteration)",
  description:
    "A simple workflow of two structured workers: one comes up with a summary, the other reviews it and suggests improvements.",
  version: "0.0.1",
});

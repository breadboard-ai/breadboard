/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

import summarizeSingleIteration from "./summarize-single-iteration";

const superDenseText =
  "In one aspect, a system is described to include computer data servers each storing and operable to serve a partition of a collection of data. The respective partitions together constitute the collection of data and each respective partition is less than the collection of data. This system also includes a processing server operable to obtain data from the data servers and to use the obtained data to process an input and to produce an output. The system can be implemented to include one or more replica data servers for each of the data servers. In one implementation, the collection of data is data for a language model for a target language. The language model includes n grams in the target language and statistical data for each of the n grams. The n grams can include N-grams with N greater than 3. The processing server is a translation server operable to translate a text in a source language in the input into the target language using the obtained data from the language model. The processing server can be implemented in various configurations, e.g., a speech recognition server operable to convert a human speech in the target language in the input into a text in the target language using the obtained data from the language model, a spelling correction server operable to correct a spelling of a word in the target language in the input using the obtained data from the language model, or an optical character recognition server operable to recognize text in a received document image in the input using the obtained data from the language model.";

type Summary = { summary: string };

const summaryExtractor = code(({ json }) => {
  return { summary: (json as Summary).summary };
});

export default await board(({ paragraph, n }) => {
  paragraph
    .title("Text to summarize")
    .isString()
    .examples(superDenseText)
    .format("multiline");
  n.title("How many times should workers iterate?").isNumber().examples("3");

  const iterate = agents.repeater({
    $id: "iterate",
    context: paragraph,
    worker: summarizeSingleIteration,
    max: n,
  });

  const finalSummarizer = agents.structuredWorker({
    $id: "finalSummarizer",
    context: iterate.context,
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
    },
  });

  const { summary } = summaryExtractor({
    $id: "extractSummary",
    json: finalSummarizer.json,
  });

  return { summary };
}).serialize({
  title: "Dense text summarizer",
  description:
    "Turns particularly dense text passages into easy-to-understand summaries",
  version: "0.0.1",
});

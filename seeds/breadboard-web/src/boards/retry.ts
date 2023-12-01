/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

const retry = new Board({
  title: "Retry",
  description:
    "Run `lambda` up to `tries` (default 5) times, appending prior attempts and error messages to the prompt.",
  version: "0.0.1",
});
const kit = retry.addKit(Starter);
const core = retry.addKit(Core);

const parameters = retry.input({
  $id: "parameters",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Original",
        description: "The original prompt",
      },
      tries: {
        type: "number",
        title: "Tries",
        description: "The number of tries to attempt to fix the problem",
        default: "5",
      },
      lambda: {
        type: "board",
        title: "Board",
        description: "The board to retry.",
      },
    },
    required: ["text", "lambda"],
  } satisfies Schema,
});

const outputSuccess = retry.output({
  $id: "outputSuccess",
  schema: {
    type: "object",
    properties: {
      additionalProperties: true,
    },
    description: "The output of the lambda",
  },
});

const outputError = retry.output({
  $id: "outputError",
  schema: {
    type: "object",
    properties: {
      $error: { type: "object" },
    },
  },
});

const generatorCaller = core.invoke({ $id: "generatorCaller" });
parameters.wire("lambda->board.", generatorCaller);

const countdown = kit.jsonata({
  expression: '{ "tries": tries - 1, (tries > 0 ? "data" : "done") : data }',
  $id: "countdown",
  tries: 5,
  raw: true,
});
parameters.wire("tries->", countdown); // Initial value, defaults to 5 (see above)
countdown.wire("tries->", countdown); // Loop back last value

const errorParser = kit.jsonata({
  expression:
    '{ "error": $exists(error.stack) ? error.stack : error.message, "completion": inputs.completion }',
  $id: "errorParser",
  raw: true,
});

const retryPrompt = kit.promptTemplate({
  template:
    "{{text}}{{completion}}\n\nThis error occured:\n{{error}}\n\nPlease try again:\n",
  $id: "retryPrompt",
});
parameters.wire("text->", retryPrompt); // First pass is with original prompt
retryPrompt.wire("prompt->text", retryPrompt); // Then keep appending

// Main flow:

parameters.wire("text->text", generatorCaller);
generatorCaller.wire("*->", outputSuccess);

generatorCaller.wire("$error->data", countdown);
countdown.wire("done->$error", outputError); // Output last error after last try
countdown.wire("data->json", errorParser); // Otherwise parse error and retry

errorParser.wire("error->", retryPrompt);
errorParser.wire("completion->", retryPrompt);

retryPrompt.wire("prompt->text", generatorCaller);

export default retry;

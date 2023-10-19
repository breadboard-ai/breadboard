/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const retry = new Board({
  title: "Retry",
  description:
    "Run `lambda` up to `tries` (default 5) times, appending prior attempts and error messages to the prompt.",
  version: "0.0.1",
});
const kit = retry.addKit(Starter);

const input = retry.input({
  schema: {
    type: "object",
    properties: {
      text: { type: "string" },
      lambda: { type: "BoardCapability" },
    },
    required: ["prompt", "completion"],
  },
});

const outputSuccess = retry.output({
  schema: {
    type: "object",
    properties: {
      completion: { type: "string" },
    },
  },
});

const outputError = retry.output({
  schema: {
    type: "object",
    properties: {
      $error: { type: "object" },
    },
  },
});

const completionCaller = retry.invoke({ $id: "lambda completion" });

const countdown = kit.jsonata(
  '{ "tries": tries - 1, (tries > 0 ? "data" : "done") : data }',
  { tries: 5, raw: true }
);
input.wire("tries->", countdown); // Initial value, defaults to 5 (see above)
countdown.wire("tries->", countdown); // Loop back last value

const errorParser = kit.jsonata(
  '{ "error": error.message, "completion": inputs.completion }',
  { raw: true }
);

const retryPrompt = kit.promptTemplate(
  "{{text}}{{completion}}\n\nThis error occured:\n{{error}}\n\nPlease try again:\n"
);
input.wire("text->", retryPrompt); // First pass is with original prompt
retryPrompt.wire("prompt->text", retryPrompt); // Then keep appending

// Main flow:

input.wire("text->text", completionCaller);
input.wire("lambda->board.", completionCaller);
completionCaller.wire("completion->", outputSuccess);

completionCaller.wire("$error->data", countdown);
countdown.wire("done->$error", outputError); // Output last error after last try
countdown.wire("data->json", errorParser); // Otherwise parse error and retry

errorParser.wire("error->", retryPrompt);
errorParser.wire("completion->", retryPrompt);

retryPrompt.wire("prompt->text", completionCaller);

export default retry;

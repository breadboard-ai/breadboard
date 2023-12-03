/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "Healer",
  description:
    "Try to heal broken text by generating new text that fixes the erros supplied by the validator",
  version: "0.0.1",
});
const starter = board.addKit(Starter);
const core = board.addKit(Core);

const brokenJSON = `{
  first_answer: "to live",
  "assumptions": [
      "life is meaningful",
      "there is a single meaning to life",
      "the meaning of life is inherent to life itself"
  ],
  "critique": [
      "life may not be meaningful",
      "there may be multiple meanings to life",
      "the meaning of life may be extrinsic to life itself"
  ],
  "response": "the meaning of life is a complex question with no easy answer"
}`;

const parameters = board.input({
  $id: "parameters",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Text to Heal",
        format: "multiline",
        description: "The text to heal, if necessary",
        default: brokenJSON,
      },
      generator: {
        type: "board",
        title: "Text Generator",
        description: "The text generator to use for healing.",
        default: "/graphs/text-generator.json",
      },
      validator: {
        type: "board",
        title: "Text Validator",
        description: "The text validator to use for healing.",
        default: "/graphs/json-validator.json",
      },
    },
    required: ["text", "gnerator", "validator"],
  } satisfies Schema,
});

const validate = core
  .invoke({
    $id: "validate",
  })
  .wire("path<-validator", parameters)
  .wire("<-text", parameters);

const generate = core
  .invoke({
    $id: "generate",
  })
  .wire("path<-generator", parameters)
  .wire("<-text", parameters)
  .wire(
    "<-useStreaming",
    core.passthrough({ $id: "dontUseStreaming", useStreaming: false })
  );

starter
  .promptTemplate({
    $id: "retryTemplate",
    template: `You are a validation error fixer. Your job is to examine the input provided and the validation errors it currently contains. Notice the format of the input produce a fix that matches the format and contains minimal modifications to input to fixes the validation error. Do not change the content of the input, only the validation errors."
INPUT:

{{text}}

The validation errors are:

ERRORS:
{{error}}

FIX:`,
  })
  .wire("<-error", validate)
  .wire("<-text", parameters)
  .wire("text->", generate);

board
  .output({
    $id: "outputSuccess",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Healed Text",
          description: "The healed text",
        },
      },
    } satisfies Schema,
  })
  .wire("<-text", generate)
  .wire("<-text", validate);

board.output({
  $id: "outputError",
  schema: {
    type: "object",
    properties: {
      error: {
        type: "object",
        title: "Error",
        description: "Error reported as a failure to heal",
      },
    },
  },
});

export default board;

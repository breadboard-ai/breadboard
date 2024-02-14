/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import { TemplateKit } from "@google-labs/template-kit";

const board = new Board({
  title: "Healer",
  description:
    "Try to heal broken text by generating new text that fixes the errors supplied by the validator",
  version: "0.0.1",
});
const templates = board.addKit(TemplateKit);
const core = board.addKit(Core);
const json = board.addKit(JSONKit);

const brokenJSON = `{
  first_answer: "to live",
  "assumptionss": [
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
        default: "text-generator.json",
      },
      validator: {
        type: "board",
        title: "Text Validator",
        description: "The text validator to use for healing.",
        default: "json-validator.json",
      },
      tries: {
        type: "number",
        title: "Tries",
        description: "The number of tries to attempt to fix the problem",
        default: "5",
      },
    },
    required: ["text", "gnerator", "validator"],
  } satisfies Schema,
});

const validate = core
  .invoke({
    $id: "validate",
  })
  .wire("path<-validator.", parameters)
  .wire("<-text", parameters);

const generate = core
  .invoke({
    $id: "generate",
  })
  .wire("path<-generator.", parameters)
  .wire(
    "<-useStreaming.",
    core.passthrough({ $id: "dontUseStreaming", useStreaming: false })
  );

// This node signifies the beginning of the cycle of healing.
// The cycle begins after validation fails.
const startCycle = core.passthrough({ $id: "startCycle" });

// Let's start by moving all parameters to the beginning of the cycle.
validate.wire("error->", startCycle);

// Reports whether or not the cycle is the first time through.
const isFirstTime = json.jsonata({
  $id: "first",
  expression: `{
    "error": error,
    "count": count + 1, 
    "tries": tries,
    (count = 0 ? 
        "first" : 
        count > 0 and count < tries ?
            "again" : 
            "done"): true
}`,
  count: 0,
  raw: true,
});
isFirstTime.wire("count->", isFirstTime);
parameters.wire("tries->.", isFirstTime);

// This node is the preamble for the first time through the cycle.
const firstTimePremble = core.passthrough({
  $id: "firstTimePremble",
  preamble: `You are a validation error fixer bot. Your job is to examine the INPUT provided and the ERRORS it currently contains. You notice the format of the input and supply a FIX that matches the format and contains minimal modifications to input to correct the validation errors. You do not change the content of the input, only the validation errors.`,
});

const otherTimePremble = core.passthrough({
  $id: "otherTimePremble",
  preamble: `Nice job, validation error fixer bot! However, you didn't get it quite right `,
});

const tryTemplate = templates.promptTemplate({
  $id: "tryTemplate",
  template: `
{{preamble}}

INPUT:

{{text}}

The validation errors are:

ERRORS:
{{error}}

FIX:`,
});

startCycle.wire("error->", isFirstTime);
isFirstTime.wire("first->", firstTimePremble);
isFirstTime.wire("again->", otherTimePremble);
firstTimePremble.wire("preamble->", tryTemplate);
otherTimePremble.wire("preamble->", tryTemplate);

tryTemplate
  .wire("<-text", parameters)
  .wire("<-text", generate)
  .wire("<-error", validate)
  .wire("prompt->text", generate);

generate.wire("text->", validate);

board
  .output({
    $id: "outputSuccess",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "object",
          title: "Healed Text",
          description: "The healed text",
        },
      },
    } satisfies Schema,
  })
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

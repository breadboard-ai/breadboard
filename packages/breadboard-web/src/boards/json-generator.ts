/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import Starter from "@google-labs/llm-starter";

const board = new Board({
  title: "JSON Generator",
  description:
    "Tries its best to always generate valid JSON that adheres to a provided JSON schema. Use it when you want your LLM calls to return valid JSON.",
  version: "0.0.1",
});
const core = board.addKit(Core);
const json = board.addKit(JSONKit);
const starter = board.addKit(Starter);

const sampleSchema = {
  type: "object",
  properties: {
    first_answer: {
      type: "string",
      description: "a first attempt at the answer to the question",
    },
    assumptions: {
      type: "array",
      items: {
        description:
          "one or more assumptions made when making the response above",
        type: "string",
      },
    },
    critique: {
      type: "array",
      items: {
        description: "how might these assumptions be wrong?",
        type: "string",
      },
    },
    response: {
      type: "string",
      description:
        "the final response made synthesizing first_answer, assumptions, and critique",
    },
  },
  required: ["first_answer", "assumptions", "critique", "response"],
  additionalProperties: false,
} satisfies Schema;

const parameters = board.input({
  $id: "parameters",
  schema: {
    type: "object",
    properties: {
      generator: {
        type: "board",
        title: "Text Generator",
        // TODO: Somehow convey the expected API of the graph
        description: "The underlying text generator to use.",
        default: "/graphs/text-generator.json",
      },
      template: {
        type: "text",
        title: "Template",
        format: "multiline",
        description:
          "the template for the reply. Insert {{format}} where you want the format to be specified",
        default: "What is the meaning of life?\n{{format}}",
      },
      schema: {
        type: "object",
        title: "Schema",
        description: "The schema of the JSON to be generated",
        default: JSON.stringify(sampleSchema, null, 2),
      },
    },
  } satisfies Schema,
});

const validOutput = board.output({
  $id: "json",
  schema: {
    type: "object",
    properties: {
      json: {
        type: "object",
        title: "JSON",
        description: "Generated JSON",
      },
    },
  } satisfies Schema,
});

const errorOutput = board.output({
  $id: "error",
  schema: {
    type: "object",
    properties: {
      error: {
        type: "object",
        title: "Error",
        description: "Generated JSON",
      },
    },
  } satisfies Schema,
});

const schemish = json.schemish().wire("<-schema", parameters);

const formatTemplate = starter
  .promptTemplate({
    $id: "formatTemplate",
    template: `Respond in valid JSON of the following structure:

{{schemish}}

RESPONSE:`,
  })
  .wire("<-schemish", schemish);

const generatorTemplate = starter
  .promptTemplate({
    $id: "generatorTemplate",
  })
  .wire("format<-prompt", formatTemplate);

const textGenerator = core
  .invoke({ $id: "textGenerator" })
  .wire("path<-generator", parameters)
  .wire(
    "<-useStreaming",
    core.passthrough({ $id: "dontUseStreaming", useStreaming: false })
  );

const validateOnce = json
  .validateJson({ $id: "validateOnce" })
  .wire("<-schema", parameters);

const validateTwice = json
  .validateJson({ $id: "validateTwice" })
  .wire("<-schema", parameters);

const errorRetryFormatter = starter.jsonata({
  expression: "$string($.error, true)",
});

const retryTemplate = starter.promptTemplate({
  $id: "retryTemplate",
  template: `The following output failed to parse as valid JSON:"
{{json}}
The error was:
{{error}}
Please reply with the corrected JSON.`,
});

const errorOutputFormatter = starter
  .jsonata({
    $id: "errorFormatter",
    expression: `{
  "type": $.error.type,
  "message": $.error.message
}`,
    raw: true,
  })
  .wire("message->error", errorOutput);

const retryGenerator = core
  .invoke({ $id: "retryGenerator" })
  .wire("path<-generator", parameters)
  .wire(
    "<-useStreaming",
    core.passthrough({ $id: "dontUseStreaming", useStreaming: false })
  );

parameters.wire(
  "template->",
  generatorTemplate.wire(
    "prompt->text",
    textGenerator
      .wire(
        "text->json",
        validateOnce
          .wire("json->", validOutput)
          .wire(
            "$error->json",
            errorRetryFormatter.wire(
              "result->error",
              retryTemplate.wire(
                "prompt->text",
                retryGenerator.wire(
                  "text->json",
                  validateTwice
                    .wire("json->", validOutput)
                    .wire("$error->json", errorOutputFormatter)
                )
              )
            )
          )
      )
      .wire("text->json", retryTemplate)
  )
);

export default board;

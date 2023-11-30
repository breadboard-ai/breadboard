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

const output = board.output({
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

const validate = json.validateJson().wire("<-schema", parameters);

parameters.wire(
  "template->",
  generatorTemplate.wire(
    "prompt->text",
    textGenerator.wire("text->json", validate.wire("json->", output))
  )
);

export default board;

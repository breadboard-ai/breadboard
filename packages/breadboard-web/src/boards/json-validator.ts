/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import JSONKit from "@google-labs/json-kit";

const board = new Board({
  title: "JSON Validator",
  description:
    "A very simple example of a validator board: it validates JSON against a schema. All validators share the same shape: `text` in, `text` out (if valid) or `error` out (if invalid).",
  version: "0.0.1",
});
const json = board.addKit(JSONKit);

const brokenJSON = `{
  first_answer: "to live",
  "guesses": [
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
      text: {
        type: "string",
        title: "JSON",
        format: "multiline",
        description: "The JSON to validate",
        examples: [brokenJSON],
      },
      schema: {
        type: "object",
        title: "Schema",
        format: "multiline",
        description: "The schema of the JSON to be generated",
        examples: [JSON.stringify(sampleSchema, null, 2)],
      },
    },
    required: ["text"],
  } satisfies Schema,
});

const validator = json
  .validateJson()
  .wire("json<-text", parameters)
  .wire("<-schema", parameters);

board
  .output({
    $id: "outputSuccess",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "object",
          title: "JSON",
          description: "The validated JSON",
        },
      },
    } satisfies Schema,
  })
  .wire("text<-json", validator);

const formatValidationError = json
  .jsonata({
    $id: "formatValidationError",
    expression: `"JSON Validation Error: " & \`$error\`.error.message & "
When validaing against this schema:

" & $string(schema, true)`,
  })
  .wire("<-schema", parameters)
  .wire("<-$error", validator);

const formatParsingError = json
  .jsonata({
    $id: "formatParsingError",
    expression: `"JSON Parsing Error: " & \`$error\`.error.message`,
  })
  .wire("<-$error", validator);

json
  .jsonata({
    $id: "parseErrorType",
    expression: `{ error.type: true }`,
    raw: true,
  })
  .wire("json<-$error", validator)
  .wire("validation->", formatValidationError)
  .wire("parsing->", formatParsingError);

board
  .output({
    $id: "outputFailure",
    schema: {
      type: "object",
      properties: {
        error: {
          type: "object",
          title: "Errors",
          description: "The validator errors that occurred",
        },
      },
    } satisfies Schema,
  })
  .wire("error<-result", formatValidationError)
  .wire("error<-result", formatParsingError);

export default board;

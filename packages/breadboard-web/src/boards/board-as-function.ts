/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, V, base, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";

const metadata = {
  title: "Board as Function",
  description: "Take a board URL and turn it into an LLM function call",
  version: "0.0.2",
};

const inputSchema = {
  type: "object",
  properties: {
    boardURL: {
      type: "string",
      title: "Board URL",
      description: "The URL of the board to convert to a function call",
      default: "/graphs/board-as-function.json",
    },
  },
} satisfies Schema;

const outputSchema = {
  type: "object",
  properties: {
    function: {
      type: "object",
      title: "Call",
      description: "The function call to make",
    },
    returns: {
      type: "object",
      title: "Returns",
      description: "Schema of the return value(s) of the function",
    },
  },
} satisfies Schema;

export default await board(() => {
  const input = base.input({ $id: "input", schema: inputSchema });
  const output = base.output({ $id: "output", schema: outputSchema });

  const getFunctionSignature = json.jsonata({
    $id: "getFunctionSignature",
    expression: `
    (
      $adjustType := function ($type) {
          $type = "object" or $type = "array" ? "string" : $type
      };

      {
      "function": {
          "name": $replace(title, /\\W/, "_"),
          "description": description,
          "parameters": {
              "type": "object",
              "properties": nodes[type="input"][0].configuration.schema.properties ~> $each(function($v, $k) {
              { $k: {
                  "type": $v.type ~> $adjustType,
                  "description": $v.description
              } }
              }) ~> $merge
          }
      },
      "returns": nodes[type="output"][0].configuration.schema ~> | ** | {}, 'title' |
      }
  )`,
    raw: true,
  });

  core
    .fetch({
      $id: "getBoard",
      $metadata: {
        title: "Get Board",
        description: "Fetching the board from the given URL",
        logLevel: "info",
      },
      url: input.boardURL as V<string>,
    })
    .response.as("json")
    .to(getFunctionSignature)
    .to(output);

  return output;
}).serialize(metadata);

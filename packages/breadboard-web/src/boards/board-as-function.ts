/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, V, base, recipe } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";

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

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: inputSchema });
  const output = base.output({ $id: "output", schema: outputSchema });

  const getFunctionSignature = starter.jsonata({
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

  starter
    .fetch({ $id: "getBoard", url: input.boardURL as V<string> })
    .response.as("json")
    .to(getFunctionSignature)
    .to(output);

  return output;
}).serialize(metadata);

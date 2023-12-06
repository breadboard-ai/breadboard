/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Starter from "@google-labs/llm-starter";

const board = new Board({
  title: "Board as Function",
  description: "Take a board URL and turn it into an LLM function call",
  version: "0.0.1",
});

const starter = board.addKit(Starter);

const input = board.input({
  $id: "input",
  schema: {
    type: "object",
    properties: {
      board: {
        type: "string",
        title: "Board URL",
        description: "The URL of the board to convert to a function call",
        default: "/graphs/board-as-function.json",
      },
    },
  },
});

const output = board.output({
  $id: "output",
  schema: {
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
  },
});

const getFunctionSignature = starter.jsonata({
  $id: "getFunctionSignature",
  expression: `
{ 
  "function": {
    "name": $replace(title, /\\W/, "_"),
    "description": description,
    "parameters": nodes[type="input"][0].configuration.schema
  }, 
  "returns": nodes[type="output"][0].configuration.schema 
}`,
  raw: true,
});

starter
  .fetch({
    $id: "getBoard",
  })
  .wire("url<-board", input)
  .wire(
    "response->json",
    getFunctionSignature.wire("function->", output).wire("returns->", output)
  );

export default board;

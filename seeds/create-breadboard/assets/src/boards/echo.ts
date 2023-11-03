/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "Echo",
  description: "Echo cho cho cho ho o",
  version: "0.0.1",
});

const query = board.input({
  $id: "input",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Echo",
        description: "What shall I say back to you?",
      },
    },
  },
});

query.wire("text->text", board.output())


export default board;

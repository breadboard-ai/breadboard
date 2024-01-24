/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";

const board = new Board({
  title: "Echo",
  description: "Echo cho cho cho ho o",
  version: "0.0.2",
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
  } satisfies Schema,
});

query.wire("text->text", board.output());

export default board;

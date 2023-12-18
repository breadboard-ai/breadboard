/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { config } from "dotenv";

config();

const board = new Board();
board
  .input()
  .wire(
    "say->",
    board
      .node(({ say }) => ({ say: `I said: ${say}` }))
      .wire("say->", board.output())
  );

const result = await board.runOnce({
  say: "Hi, how are you?",
});
console.log("result", result);

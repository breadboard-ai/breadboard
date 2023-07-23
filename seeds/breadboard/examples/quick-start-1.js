/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

const board = new Board();

const input = board.input();

const output = board.output();

input.wire("say->hear", output);

const result = await board.runOnce({
  say: "Hello, world?",
});
console.log("result", result);

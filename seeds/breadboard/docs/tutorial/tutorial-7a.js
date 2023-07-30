/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, LogProbe } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { config } from "dotenv";

config();

const board = new Board();
// add kit to the board
const kit = board.addKit(Starter);

const output = board.output();
board
  .input()
  .wire("say->", output)
  .wire(
    "say->text",
    kit
      .textCompletion()
      .wire("completion->hear", output)
      .wire("<-API_KEY", kit.secrets(["API_KEY"]))
  );

const result = await board.runOnce(
  {
    say: "Hi, how are you?",
  },
  new LogProbe()
);
console.log("result", result);

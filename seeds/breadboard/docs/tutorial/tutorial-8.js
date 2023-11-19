/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { config } from "dotenv";

config();

const board = new Board();
// add kit to the board
const kit = board.addKit(Starter);

const output = board.output();
board.input().wire(
  "say->text",
  kit
    .generateText()
    .wire("completion->hear", output)
    .wire("<-PALM_KEY", kit.secrets({ keys: ["PALM_KEY"] }))
);

for await (const stop of board.run()) {
  if (stop.type === "input") {
    stop.inputs = { say: "Hi, how are you?" };
  } else if (stop.type === "output") {
    console.log("result", stop.outputs);
  }
}

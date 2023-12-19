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
const kit = board.addKit(Starter);

const output = board.output();
board
  .input()
  .wire(
    "say->",
    board.node(({ say }) => ({ say: `I said: ${say}` })).wire("say->", output)
  )
  .wire(
    "say->text",
    kit
      .generateText()
      .wire("completion->hear", output)
      .wire("<-PALM_KEY", kit.secrets({ keys: ["PALM_KEY"] }))
  );

const result = await board.runOnce({
  say: "Hi, how are you?",
});
console.log("result", result);

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

const json = JSON.stringify(board, null, 2);

import { writeFile } from "fs/promises";

await writeFile("./quick-start-4.json", json);

const board2 = await Board.load("./quick-start-4.json");

const result = await board2.runOnce({
  say: "Hi, how are you?",
});

console.log("result", result);

const diagram = board2.mermaid();

console.log(diagram);

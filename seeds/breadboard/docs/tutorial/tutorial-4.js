/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { config } from "dotenv";

import * as path from 'path';
import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));

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
      .generateText()
      .wire("completion->hear", output)
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
  );

const json = JSON.stringify(board, null, 2);

import { writeFile } from "fs/promises";

await writeFile(path.join(__dir, "tutorial-4.json"), json);

const board2 = await Board.load(path.join(__dir, "tutorial-4.json"));

const result = await board2.runOnce({
  say: "Hi, how are you?",
});
console.log("result", result);

const diagram = board2.mermaid();
console.log(diagram);

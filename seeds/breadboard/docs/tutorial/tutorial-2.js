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

const input = board.input();
const output = board.output();
const generateText = kit.generateText();

input.wire("say->text", generateText);
generateText.wire("completion->hear", output);

const secrets = kit.secrets(["PALM_KEY"]);

secrets.wire("PALM_KEY->", generateText);

const result = await board.runOnce({
  say: "Hi, how are you?",
});
console.log("result", result);

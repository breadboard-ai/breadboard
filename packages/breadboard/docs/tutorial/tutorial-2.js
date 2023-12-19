/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";
import { config } from "dotenv";

config();

const board = new Board();
// add kits to the board
const starter = board.addKit(Starter);
const palm = board.addKit(PaLMKit);

const input = board.input();
const output = board.output();
const generateText = palm.generateText();

input.wire("say->text", generateText);
generateText.wire("completion->hear", output);

const secrets = starter.secrets({ keys: ["PALM_KEY"] });

secrets.wire("PALM_KEY->", generateText);

const result = await board.runOnce({
  say: "Hi, how are you?",
});
console.log("result", result);

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
      .generateText()
      .wire("completion->hear", output)
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
  );

const probe = new EventTarget();

probe.addEventListener("node", (event) => {
  const data = event.detail;
  if (data.descriptor.type == "generateText") {
    console.log("completion:", data.outputs.completion);
  }
});

const result = await board.runOnce(
  { say: "Hi, how are you?" },
  undefined,
  probe
);
console.log("result", result);

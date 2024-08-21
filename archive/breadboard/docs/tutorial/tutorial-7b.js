/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { PaLMKit } from "@google-labs/palm-kit";

import { config } from "dotenv";

config();

const board = new Board();
// add kits to the board
const core = board.addKit(Core);
const palm = board.addKit(PaLMKit);

const output = board.output();
board
  .input()
  .wire("say->", output)
  .wire(
    "say->text",
    palm
      .generateText()
      .wire("completion->hear", output)
      .wire("<-PALM_KEY", core.secrets({ keys: ["PALM_KEY"] }))
  );

const probe = new EventTarget();

probe.addEventListener("node", (event) => {
  const data = event.detail;
  if (data.descriptor.type == "palm-generateText") {
    console.log("completion:", data.outputs.completion);
  }
});

const result = await board.runOnce({ say: "Hi, how are you?" }, { probe });
console.log("result", result);

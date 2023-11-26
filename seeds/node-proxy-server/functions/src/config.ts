/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { defineConfig } from "@google-labs/breadboard/remote";
import Starter from "@google-labs/llm-starter";
import PaLMKit from "@google-labs/palm-kit";

const board = new Board();
board.addKit(Starter);
board.addKit(PaLMKit);

export default defineConfig({
  board,
  proxy: [
    "fetch",
    {
      node: "secrets",
      tunnel: {
        PALM_KEY: ["palm-generateText", "palm-embedText"],
      },
    },
  ],
});

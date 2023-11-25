/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { defineConfig } from "@google-labs/breadboard/remote";
import Starter from "@google-labs/llm-starter";

const board = new Board();
board.addKit(Starter);

export default defineConfig({
  board,
  proxy: [
    "fetch",
    {
      node: "secrets",
      protect: {
        PALM_KEY: ["palm-generateText", "palm-embedText"],
      },
    },
  ],
});

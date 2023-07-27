/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { config } from "dotenv";

config();

const board = new Board();

const NEWS_URL =
  "https://gist.githubusercontent.com/dglazkov/6f122553b4c08f0674187f79b19c01f4/raw/google-news.json";

board
  .input()
  .wire(
    "say->text",
    board.include(NEWS_URL).wire("text->hear", board.output())
  );

const result = await board.runOnce({ say: "Latest news on breadboards" });

console.log("result", result);

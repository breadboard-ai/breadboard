/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import { config } from "dotenv";

config();

const NEWS_SUMMARIZER_URL =
  "https://gist.githubusercontent.com/dglazkov/dd3f071260a1c3b97aa81beac6045da3/raw/news-summarizer.json";

const NEWS_BOARD_URL =
  "https://gist.githubusercontent.com/dglazkov/55db9bb36acd5ba5cfbd82d2901e7ced/raw/google-news-headlines.json";

const news = await Board.load(NEWS_BOARD_URL);

const board = await Board.load(NEWS_SUMMARIZER_URL, { news });

const result = await board.runOnce({ topic: "Latest news on breadboards" });
console.log("result", result);

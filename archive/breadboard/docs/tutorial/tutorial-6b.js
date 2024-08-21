/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, asRuntimeKit } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { TemplatesKit } from "@google-labs/template-kit";
import { PaLMKit } from "@google-labs/palm-kit";

import { config } from "dotenv";

config();

const NEWS_SUMMARIZER_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/breadboard/docs/tutorial/news-summarizer.json";

const NEWS_BOARD_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/breadboard/docs/tutorial/google-news-headlines.json";

const news = await Board.load(NEWS_BOARD_URL);

const board = await Board.load(NEWS_SUMMARIZER_URL, { slotted: { news } });

const result = await board.runOnce(
  { topic: "Latest news on breadboards" },
  {
    kits: [
      asRuntimeKit(Core),
      asRuntimeKit(TemplatesKit),
      asRuntimeKit(PaLMKit),
    ],
  }
);
console.log("result", result);

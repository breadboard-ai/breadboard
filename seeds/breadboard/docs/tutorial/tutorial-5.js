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
const kit = board.addKit(Starter);

const NEWS_BOARD_URL =
  "https://gist.githubusercontent.com/dglazkov/55db9bb36acd5ba5cfbd82d2901e7ced/raw/google-news-headlines.json";

const template = kit.promptTemplate(
  "Use the news headlines below to write a few sentences to" +
    "summarize the latest news on this topic:\n\n##Topic:\n" +
    "{{topic}}\n\n## Headlines {{headlines}}\n\\n## Summary:\n"
);

const input = board.input();
input.wire(
  "say->topic",
  board.include(NEWS_BOARD_URL).wire(
    "headlines->",
    template.wire("topic<-say", input).wire(
      "prompt->text",
      kit
        .generateText()
        .wire("<-PALM_KEY.", kit.secrets({ keys: ["PALM_KEY"] }))
        .wire("completion->say", board.output())
    )
  )
);

const result = await board.runOnce({ say: "Latest news on breadboards" });
console.log("result", result);

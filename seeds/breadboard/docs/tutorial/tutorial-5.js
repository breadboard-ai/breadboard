/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";

import { config } from "dotenv";

config();

const board = new Board();
const core = board.addKit(Core);
const starter = board.addKit(Starter);
const palm = board.addKit(PaLMKit);

const NEWS_BOARD_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/breadboard/docs/tutorial/news-summarizer.json";

const template = starter.promptTemplate({
  template:
    "Use the news headlines below to write a few sentences to " +
    "summarize the latest news on this topic:\n\n##Topic:\n" +
    "{{topic}}\n\n## Headlines\n{{headlines}}\n\n## Summary:\n",
});

const input = board.input();
input.wire(
  "say->topic",
  core.include({ path: NEWS_BOARD_URL }).wire(
    "headlines->",
    template.wire("topic<-say", input).wire(
      "prompt->text",
      palm
        .generateText()
        .wire("<-PALM_KEY.", starter.secrets({ keys: ["PALM_KEY"] }))
        .wire("completion->say", board.output())
    )
  )
);

const result = await board.runOnce({ say: "Latest news on breadboards" });
console.log("result", result);

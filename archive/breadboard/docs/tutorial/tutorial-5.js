/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { TemplateKit } from "@google-labs/template-kit";
import { PaLMKit } from "@google-labs/palm-kit";

import { config } from "dotenv";

config();

const board = new Board();
const core = board.addKit(Core);
const templates = board.addKit(TemplateKit);
const palm = board.addKit(PaLMKit);

const NEWS_BOARD_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/breadboard/docs/tutorial/google-news-headlines.json";

const template = templates.promptTemplate({
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
        .wire("<-PALM_KEY.", core.secrets({ keys: ["PALM_KEY"] }))
        .wire("completion->say", board.output())
    )
  )
);

const result = await board.runOnce({ say: "Latest news on breadboards" });
console.log("result", result);

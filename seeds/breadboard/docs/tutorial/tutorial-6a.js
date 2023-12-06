/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";

import { writeFile } from "fs/promises";

import { config } from "dotenv";

import * as path from "path";
import { fileURLToPath } from "url";
const __dir = path.dirname(fileURLToPath(import.meta.url));

config();

const board = new Board();
const core = board.addKit(Core);
const starter = board.addKit(Starter);
const palm = board.addKit(PaLMKit);

const template = starter.promptTemplate({
  template:
    "Use the news headlines below to write a few sentences to " +
    "summarize the latest news on this topic:\n\n##Topic:\n" +
    "{{topic}}\n\n## Headlines\n{{headlines}}\n\n## Summary:\n",
});

const input = board.input();
input.wire(
  "topic->",
  core.slot({ slot: "news" }).wire(
    "headlines->",
    template.wire("topic<-", input).wire(
      "prompt->text",
      palm
        .generateText()
        .wire("<-PALM_KEY.", starter.secrets({ keys: ["PALM_KEY"] }))
        .wire("completion->summary", board.output())
    )
  )
);

const json = JSON.stringify(board, null, 2);
await writeFile(path.join(__dir, "news-summarizer.json"), json);

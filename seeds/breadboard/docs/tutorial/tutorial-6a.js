/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { writeFile } from "fs/promises";

import { config } from "dotenv";

import * as path from 'path';
import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));

config();

const board = new Board();
const kit = board.addKit(Starter);

const template = kit.promptTemplate(
  "Use the news headlines below to write a few sentences to" +
    "summarize the latest news on this topic:\n\n##Topic:\n" +
    "{{topic}}\n\n## Headlines {{headlines}}\n\\n## Summary:\n"
);

const input = board.input();
input.wire(
  "topic->",
  board.slot("news").wire(
    "headlines->",
    template.wire("topic<-", input).wire(
      "prompt->text",
      kit
        .generateText()
        .wire("<-PALM_KEY.", kit.secrets({ keys: ["PALM_KEY"] }))
        .wire("completion->summary", board.output())
    )
  )
);

const json = JSON.stringify(board, null, 2);
await writeFile(path.join(__dir, "news-summarizer.json"), json);

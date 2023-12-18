/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { writeFile } from "fs/promises";

import * as path from "path";
import { fileURLToPath } from "url";
const __dir = path.dirname(fileURLToPath(import.meta.url));

const board = new Board();
const starter = board.addKit(Starter);

const input = board.input({ message: "Enter news topic" });

input.wire(
  "topic->query",
  starter
    .urlTemplate({
      template:
        "https://news.google.com/rss/search?q={{query}}&hl=en-US&gl=US&ceid=US:en",
    })
    .wire(
      "url->",
      starter.fetch({ raw: true }).wire(
        "response->xml",
        starter.xmlToJson().wire(
          "json->",
          starter
            .jsonata({
              expression: "$join((rss.channel.item.title.`$t`)[[1..20]], '\n')",
            })
            .wire("result->headlines", board.output())
        )
      )
    )
);

const result = await board.runOnce({ topic: "Latest news on breadboards" });
console.log("result", result);

const json = JSON.stringify(board, null, 2);
await writeFile(path.join(__dir, "google-news-headlines.json"), json);

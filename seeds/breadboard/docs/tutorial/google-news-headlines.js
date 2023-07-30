/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { writeFile } from "fs/promises";

const board = new Board();
const kit = board.addKit(Starter);

const input = board.input("Enter news topic");

input.wire(
  "topic->query",
  kit
    .urlTemplate(
      "https://news.google.com/rss/search?q={{query}}&hl=en-US&gl=US&ceid=US:en"
    )
    .wire(
      "url->",
      kit
        .fetch(true)
        .wire(
          "response->xml",
          kit
            .xmlToJson()
            .wire(
              "json->",
              kit
                .jsonata("$join((rss.channel.item.title.`$t`)[[1..20]], '\n')")
                .wire("result->headlines", board.output())
            )
        )
    )
);

const result = await board.runOnce({ topic: "Latest news on breadboards" });
console.log("result", result);

const json = JSON.stringify(board, null, 2);
await writeFile("./docs/tutorial/google-news-headlines.json", json);

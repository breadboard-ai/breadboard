/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
const kit = board.addKit(Starter);

const input = board.input("What would you like to search for?");

input.wire(
  "text->query",
  kit
    .urlTemplate(
      "https://news.google.com/rss/search?q={{query}}&hl=en-US&gl=US&ceid=US:en"
    )
    .wire(
      "url->",
      kit.fetch(true).wire(
        "response->xml",
        kit.xmlToJson().wire(
          "json->",
          kit
            .jsonata("$join((rss.channel.item.title.`$t`)[[1..20]], '\n')")
            .wire(
              "result->headlines",
              kit
                .promptTemplate(
                  "Use the news headlines below to write a few sentences to" +
                    "summarize the latest news on this topic:\n\n##Topic:\n" +
                    "{{topic}}\n\n## Headlines {{headlines}}\n\\n## Summary:\n"
                )
                .wire("topic<-text", input)
                .wire(
                  "prompt->text",
                  kit
                    .generateText()
                    .wire("<-PALM_KEY.", kit.secrets(["PALM_KEY"]))
                    .wire("completion->text", board.output())
                )
            )
        )
      )
    )
);

export default board;

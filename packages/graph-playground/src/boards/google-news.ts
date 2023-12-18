/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";

const board = new Board();
const kit = board.addKit(Starter);
const palm = board.addKit(PaLMKit);

const input = board.input({
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Query",
        description: "What would you like to search for?",
      },
    },
    required: ["text"],
  },
});

input.wire(
  "text->query",
  kit
    .urlTemplate({
      template: "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en",
    })
    .wire(
      "url->",
      kit.fetch({ raw: true }).wire(
        "response->xml",
        kit.xmlToJson().wire(
          "json->",
          kit
            .jsonata({ expression: "$join((rss.channel.item.title.`$t`)[[1..20]], '\n')" })
            .wire(
              "result->headlines",
              kit
                .promptTemplate({
                  template:
                    "Use the news headlines below to write a few sentences to" +
                    "summarize the latest news on this topic:\n\n##Topic:\n" +
                    "{{topic}}\n\n## Headlines {{headlines}}\n\\n## Summary:\n",
                })
                .wire("topic<-text", input)
                .wire(
                  "prompt->text",
                  palm
                    .generateText()
                    .wire("<-PALM_KEY.", kit.secrets({ keys: ["PALM_KEY"] }))
                    .wire("completion->text", board.output())
                )
            )
        )
      )
    )
);

export default board;

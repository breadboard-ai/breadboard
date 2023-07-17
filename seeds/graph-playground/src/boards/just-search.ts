/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
const kit = board.addKit(Starter);

const secrets = kit.secrets(["API_KEY", "GOOGLE_CSE_ID"]);

board.input("What would you like to search for?").wire(
  "text->query",
  kit
    .urlTemplate(
      "https://www.googleapis.com/customsearch/v1?key={{API_KEY}}&cx={{GOOGLE_CSE_ID}}&q={{query}}"
    )
    .wire("<-API_KEY.", secrets)
    .wire("<-GOOGLE_CSE_ID.", secrets)
    .wire(
      "url",
      kit
        .fetch()
        .wire(
          "response->json",
          kit
            .jsonata("$join(items.snippet, '\n')")
            .wire("result->text", board.output())
        )
    )
);

export default board;

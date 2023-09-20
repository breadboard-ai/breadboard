/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Nursery, lambda } from "@google-labs/node-nursery";

const board = new Board({
  title: "Loading Chunks into Pinecone",
  description:
    "This board is a simple example of loading chunked data into Pinecone.",
  version: "0.0.1",
});
const kit = board.addKit(Starter);
const nursery = board.addKit(Nursery);

board.input({ $id: "url" }).wire(
  "text->url",
  kit.fetch(false, { $id: "load-chunks" }).wire(
    "response->json",
    kit
      .jsonata(
        'content.$zip($keys(),*)[[0..3]].{"id": $[0],"text": text,"metadata": info}',
        { $id: "get-content" }
      )
      .wire(
        "result->list",
        nursery
          .map(
            await lambda(async (board, input, output) => {
              const nursery = board.addKit(Nursery);
              const starter = board.addKit(Starter);
              const merge = starter.append({ $id: "merge" });
              input
                .wire(
                  "item->json",
                  starter.jsonata("text").wire(
                    "result->text",
                    nursery
                      .embedString()
                      .wire("embedding->", merge)
                      .wire("<-PALM_KEY", starter.secrets(["PALM_KEY"]))
                  )
                )
                .wire(
                  "item->accumulator",
                  merge.wire("accumulator->item", output)
                );
            })
          )
          .wire("list->text", board.output())
      )
  )
);

export default board;

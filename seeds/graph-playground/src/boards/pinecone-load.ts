/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Nursery, lambda } from "@google-labs/node-nursery";

const PINECONE_BATCH_SIZE = 40;
// TODO: Because URL of the lamdba-created board is not resolved relative to
// the board that invokes the lambda, only absolute include URLs work.
// We need to figure out how to resolve relative URLs in labmdas.
const PINECONE_API_UPSERT_BOARD_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/pinecone-api-upsert.json";

const generateEmebeddings = lambda(
  async (board, input, output) => {
    const nursery = board.addKit(Nursery);
    const starter = board.addKit(Starter);
    const merge = starter.append({ $id: "merge" });
    input
      .wire(
        "item->json",
        starter.jsonata("metadata.text").wire(
          "result->text",
          nursery
            .embedString()
            .wire("embedding->", merge)
            .wire("<-PALM_KEY", starter.secrets(["PALM_KEY"]))
        )
      )
      .wire("item->accumulator", merge.wire("accumulator->item", output));
  },
  { $id: "generate-embeddings" }
);

const processBatch = lambda(async (board, input, output) => {
  const starter = board.addKit(Starter);
  const nursery = board.addKit(Nursery);

  const pineconeUpsert = board.include(PINECONE_API_UPSERT_BOARD_URL, {
    $id: "pinecone-api-upsert",
  });

  input.wire(
    "item->list",
    nursery
      .map(await generateEmebeddings)
      .wire(
        "list->json",
        starter
          .jsonata(
            '{ "vectors": item.[ { "id": id, "values": embedding, "metadata": metadata } ]}',
            { $id: "format-to-api" }
          )
          .wire(
            "result->vectors",
            pineconeUpsert.wire("response->item", output)
          )
      )
  );
});

const board = new Board({
  title: "Loading Chunks into Pinecone",
  description:
    "This board is a simple example of loading chunked data into Pinecone.",
  version: "0.0.1",
});
const kit = board.addKit(Starter);
const nursery = board.addKit(Nursery);

board
  .input({ $id: "url" })
  .wire(
    "text->url",
    kit
      .fetch(false, { $id: "load-chunks" })
      .wire(
        "response->json",
        kit
          .jsonata(
            'content.$zip($keys(),*).{"id": $[0],"metadata": {"text": text,"url": info.url,"title": info.title,"description":info.description}}',
            { $id: "get-content" }
          )
          .wire(
            "result->list",
            nursery
              .batcher({ size: PINECONE_BATCH_SIZE })
              .wire(
                "list->",
                nursery
                  .map(await processBatch)
                  .wire("list->text", board.output())
              )
          )
      )
  );

export default board;

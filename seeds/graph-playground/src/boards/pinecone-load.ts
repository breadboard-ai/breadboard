/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, LambdaFunction } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";
import Pinecone from "@google-labs/pinecone-kit";

const PINECONE_BATCH_SIZE = 40;

const generateEmbeddings: LambdaFunction = (board, input, output) => {
  const starter = board.addKit(Starter);
  const core = board.addKit(Core);
  const merge = core.append({ $id: "merge" });
  input
    .wire(
      "item->json",
      starter.jsonata("metadata.text").wire(
        "result->text",
        starter
          .embedText()
          .wire("embedding->", merge)
          .wire("<-PALM_KEY", starter.secrets(["PALM_KEY"]))
      )
    )
    .wire("item->accumulator", merge.wire("accumulator->item", output));
};

const processBatch: LambdaFunction = (board, input, output) => {
  const starter = board.addKit(Starter);
  const core = board.addKit(Core);
  const pinecone = board.addKit(Pinecone);

  input.wire(
    "item->list",
    core
      .map({ board: generateEmbeddings, $id: "generate-embeddings" })
      .wire(
        "list->json",
        starter
          .jsonata(
            '{ "vectors": item.[ { "id": id, "values": embedding, "metadata": metadata } ]}',
            { $id: "format-to-api" }
          )
          .wire(
            "result->vectors",
            pinecone.upsert().wire("response->item", output)
          )
      )
  );
};

const board = new Board({
  title: "Loading Chunks into Pinecone",
  description:
    "This board is a simple example of loading chunked data into Pinecone.",
  version: "0.0.1",
});
const kit = board.addKit(Starter);
const core = board.addKit(Core);

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
            core
              .batch({ size: PINECONE_BATCH_SIZE })
              .wire(
                "list->",
                core.map(processBatch).wire("list->text", board.output())
              )
          )
      )
  );

export default board;

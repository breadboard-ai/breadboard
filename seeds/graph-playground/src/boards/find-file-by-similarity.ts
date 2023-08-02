/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const findFileBySimilarity = new Board();
const kit = findFileBySimilarity.addKit(Starter);

const vectorDatabase = kit.createVectorDatabase();
const queryVectorDatabase = kit.queryVectorDatabase();

findFileBySimilarity.input("Provide a path to a directory to search").wire(
  "text->path",
  kit.textAssetsFromPath().wire(
    "documents",
    kit
      .embedDocs()
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
      .wire(
        "<-cache",
        kit.cache().wire("path<-CACHE_DB", kit.secrets(["CACHE_DB"]))
      )
      .wire(
        "documents",
        kit
          .addToVectorDatabase()
          .wire("<-db", vectorDatabase)
          .wire("db", queryVectorDatabase) // Ensure query runs after indexing
      )
  )
);

findFileBySimilarity.input("What do you want to search for?").wire(
  "text",
  kit
    .embedString()
    .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
    .wire(
      "embedding",
      queryVectorDatabase.wire(
        "results->json",
        kit
          .jsonata(
            `
              $join(
                $map(*, function($v, $i, $a) {
                  $v.document.id & ": " & $string($v.similarity)
                }),
                "\n"
              )
            `
          )
          .wire("result->text", findFileBySimilarity.output())
      )
    )
);

export default findFileBySimilarity;

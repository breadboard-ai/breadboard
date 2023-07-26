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
      .wire("<-API_KEY", kit.secrets(["API_KEY"]))
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
    .wire("<-API_KEY", kit.secrets(["API_KEY"]))
    .wire(
      "embedding",
      queryVectorDatabase.wire(
        "results->json",
        kit
          .jsonata('$join($$.id, "\n")')
          .wire("result->text", findFileBySimilarity.output())
      )
    )
);

export default findFileBySimilarity;

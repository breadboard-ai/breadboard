/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import { Nursery } from "@google-labs/node-nursery";

const findFileBySimilarity = new Board();
const json = findFileBySimilarity.addKit(JSONKit);
const nursery = findFileBySimilarity.addKit(Nursery);
const core = findFileBySimilarity.addKit(Core);

const vectorDatabase = nursery.createVectorDatabase();
const queryVectorDatabase = nursery.queryVectorDatabase();

findFileBySimilarity
  .input({
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Path",
          description: "Provide a path to a directory to search",
        },
      },
      required: ["text"],
    },
  })
  .wire(
    "text->path",
    nursery.textAssetsFromPath().wire(
      "documents",
      nursery
        .embedDocs()
        .wire("<-PALM_KEY", core.secrets({ keys: ["PALM_KEY"] }))
        .wire(
          "<-cache",
          nursery
            .cache()
            .wire("path<-CACHE_DB", core.secrets({ keys: ["CACHE_DB"] }))
        )
        .wire(
          "documents",
          nursery
            .addToVectorDatabase()
            .wire("<-db", vectorDatabase)
            .wire("db", queryVectorDatabase) // Ensure query runs after indexing
        )
    )
  );

findFileBySimilarity
  .input({
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Query",
          description: "What do you want to search for?",
        },
      },
      required: ["text"],
    },
  })
  .wire(
    "text",
    nursery
      .embedString()
      .wire("<-PALM_KEY", core.secrets({ keys: ["PALM_KEY"] }))
      .wire(
        "embedding",
        queryVectorDatabase.wire(
          "results->json",
          json
            .jsonata({
              expression: `
              $join(
                $map(*, function($v, $i, $a) {
                  $v.document.id & ": " & $string($v.similarity)
                }),
                "\n"
              )`,
            })
            .wire("result->text", findFileBySimilarity.output())
        )
      )
  );

export default findFileBySimilarity;

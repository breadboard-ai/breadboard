/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import { NodeNurseryWeb } from "@google-labs/node-nursery-web";

const board = new Board({
  title: "List Google Drive files",
  description: "First attempt at a Google Drive node",
  version: "0.0.1",
});
const nursery = board.addKit(NodeNurseryWeb);
const core = board.addKit(Core);
const json = board.addKit(JSONKit);

const parseDriveList = json.jsonata({
  expression: '$join(result.files.name, "\n")',
  $id: "parseDriveList",
});

const query = board.input({
  $id: "query",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        title: "Query",
        description: "Search drive files with this query",
      },
    },
  },
});

nursery
  .credentials({
    $id: "credentials",
  })
  .wire("<-API_KEY", core.secrets({ keys: ["API_KEY"] }))
  .wire("<-AUTH_DOMAIN", core.secrets({ keys: ["AUTH_DOMAIN"] }))
  .wire("<-PROJECT_ID", core.secrets({ keys: ["PROJECT_ID"] }))
  .wire(
    "<-scopes",
    core.passthrough({
      $id: "scopes",
      scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
    })
  )
  .wire(
    "accessToken->",
    nursery
      .driveList({
        $id: "driveList",
      })
      .wire("q<-query", query)
      .wire(
        "list->json",
        parseDriveList.wire(
          "result->list",
          board.output({
            $id: "output",
            schema: {
              type: "object",
              properties: {
                list: {
                  type: "string",
                  title: "Drive List",
                  description: "The list of drive files",
                },
              },
            },
          })
        )
      )
  );

export default board;

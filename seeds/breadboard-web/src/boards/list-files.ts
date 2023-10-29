/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

const board = new Board({
  title: "List Google Drive files",
  description: "First attempt at a Google Drive node",
  version: "0.0.1",
});

board
  .input({
    $id: "input",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Text",
          description: "Text to display",
        },
      },
    },
  })
  .wire(
    "*",
    board.output({
      $id: "output",
      schema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            title: "Text",
            description: "Text to display",
          },
        },
      },
    })
  );

export default board;

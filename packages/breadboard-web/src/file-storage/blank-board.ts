/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard";

export const BLANK_BOARD = {
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
  edges: [
    {
      from: "input-1",
      to: "output-2",
      out: "text",
      in: "text",
    },
  ],
  nodes: [
    {
      id: "output-2",
      type: "output",
      configuration: {
        schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              title: "text",
            },
          },
        },
      },
    },
    {
      id: "input-1",
      type: "input",
      configuration: {
        schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              title: "text",
            },
          },
          required: ["text"],
        },
      },
    },
  ],
  graphs: {},
} satisfies GraphDescriptor;

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import handler from "../src/nodes/invoke.js";

test("describe with no values and no context.base", async (t) => {
  t.deepEqual(await handler.describe(), {
    inputSchema: {
      additionalProperties: false,
      properties: {
        $board: {
          behavior: ["board", "config"],
          description:
            "The board to invoke. Can be a BoardCapability, a graph or a URL",
          title: "board",
          type: "object",
          additionalProperties: false,
          properties: {},
          required: [],
        },
        path: {
          behavior: ["deprecated"],
          description: "The path to the board to invoke.",
          title: "path",
          type: "string",
        },
      },
      type: "object",
      required: [],
    },
    outputSchema: {
      additionalProperties: false,
      properties: {},
      type: "object",
      required: [],
    },
  });
});

test("describe with context.base and no values", async (t) => {
  t.deepEqual(
    await handler.describe(undefined, undefined, undefined, {
      base: new URL("http://example.com/"),
      outerGraph: { nodes: [], edges: [] },
    }),
    {
      inputSchema: {
        properties: {
          $board: {
            behavior: ["board", "config"],
            description:
              "The board to invoke. Can be a BoardCapability, a graph or a URL",
            title: "board",
            type: "object",
            additionalProperties: false,
            properties: {},
            required: [],
          },
          path: {
            behavior: ["deprecated"],
            description: "The path to the board to invoke.",
            title: "path",
            type: "string",
          },
        },
        type: "object",
        required: [],
        additionalProperties: true,
      },
      outputSchema: {
        properties: {},
        type: "object",
        required: [],
        additionalProperties: true,
      },
    }
  );
});

test("describe with context.base and invalid $board", async (t) => {
  t.deepEqual(
    await handler.describe({ $board: "invalid.json" }, undefined, undefined, {
      base: new URL("file://invalid/base"),
      outerGraph: { nodes: [], edges: [] },
    }),
    {
      inputSchema: {
        properties: {
          $board: {
            behavior: ["board", "config"],
            description:
              "The board to invoke. Can be a BoardCapability, a graph or a URL",
            title: "board",
            type: "object",
            additionalProperties: false,
            properties: {},
            required: [],
          },
          path: {
            behavior: ["deprecated"],
            description: "The path to the board to invoke.",
            title: "path",
            type: "string",
          },
        },
        type: "object",
        required: [],
        additionalProperties: true,
      },
      outputSchema: {
        properties: {},
        type: "object",
        required: [],
        additionalProperties: true,
      },
    }
  );
});

test("describe with context.base and valid $board", async (t) => {
  t.deepEqual(
    await handler.describe(
      {
        $board: {
          nodes: [
            {
              type: "input",
              id: "input-1",
              configuration: {
                schema: {
                  type: "object",
                  properties: {
                    invokedBoardInput: { type: "string" },
                  },
                  required: ["invokedBoardInput"],
                },
              },
            },
            {
              type: "output",
              id: "output-1",
              configuration: {
                schema: {
                  type: "object",
                  properties: {
                    invokedBoardOutput: { type: "number" },
                  },
                },
              },
            },
          ],
          edges: [],
        },
      },
      undefined,
      undefined,
      {
        base: new URL("http://example.com/"),
        outerGraph: { nodes: [], edges: [] },
      }
    ),
    {
      inputSchema: {
        type: "object",
        properties: {
          $board: {
            behavior: ["board", "config"],
            description:
              "The board to invoke. Can be a BoardCapability, a graph or a URL",
            title: "board",
            type: "object",
            additionalProperties: false,
            properties: {},
            required: [],
          },
          path: {
            behavior: ["deprecated"],
            description: "The path to the board to invoke.",
            title: "path",
            type: "string",
          },
          invokedBoardInput: {
            type: "string",
          },
        },
        required: ["invokedBoardInput"],
      },
      outputSchema: {
        type: "object",
        properties: {
          invokedBoardOutput: {
            type: "number",
          },
        },
        required: [],
        additionalProperties: false,
      },
    }
  );
});

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import {
  functionOrTextRouterFunction,
  functionSignatureFromBoardFunction,
} from "../src/function-calling.js";
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GraphDescriptor } from "@google-labs/breadboard";

describe("function-calling/functionOrTextRouterFunction", () => {
  test("functionOrTextRouterFunction throws when no context is supplied", () => {
    throws(() => {
      functionOrTextRouterFunction({});
    });
  });

  test("functionOrTextRouterFunction throws when no text or function call is found", () => {
    throws(() => {
      functionOrTextRouterFunction({
        context: {
          parts: [],
        },
      });
    });
  });

  test("functionOrTextRouterFunction handles text", () => {
    const context = {
      parts: [{ text: "Hello" }],
    };
    const result = functionOrTextRouterFunction({
      context,
    });
    deepStrictEqual(result, { context, text: "Hello" });
  });

  test("functionOrTextRouterFunction handles function call", () => {
    const context = {
      parts: [
        {
          functionCall: {
            name: "Get_Web_Page_Content",
            args: {
              url: "https://example.com/",
            },
          },
        },
      ],
    };
    const result = functionOrTextRouterFunction({
      context,
    });
    deepStrictEqual(result, {
      context,
      functionCall: {
        name: "Get_Web_Page_Content",
        args: {
          url: "https://example.com/",
        },
      },
    });
  });

  test("functionOrTextRouterFunction handles multiple parts", () => {
    {
      const context = {
        parts: [{ text: "Hello" }, { text: "World" }],
      };
      const result = functionOrTextRouterFunction({
        context,
      });
      deepStrictEqual(result, { context, text: "Hello" });
    }
    {
      const context = {
        parts: [
          { text: "Hello" },
          {
            functionCall: {
              name: "Get_Web_Page_Content",
              args: {
                url: "https://example.com/",
              },
            },
          },
        ],
      };
      const result = functionOrTextRouterFunction({
        context,
      });
      deepStrictEqual(result, {
        context,
        functionCall: {
          name: "Get_Web_Page_Content",
          args: {
            url: "https://example.com/",
          },
        },
      });
    }
    {
      const context = {
        parts: [
          {
            functionCall: {
              name: "Get_Web_Page_Content",
              args: {
                url: "https://example.com/",
              },
            },
          },
          { text: "Hello" },
        ],
      };
      const result = functionOrTextRouterFunction({
        context,
      });
      deepStrictEqual(result, {
        context,
        functionCall: {
          name: "Get_Web_Page_Content",
          args: {
            url: "https://example.com/",
          },
        },
      });
    }
  });
});

const loadBoard = async (name: string) => {
  const board = await readFile(
    resolve(
      new URL(import.meta.url).pathname,
      `../../../tests/boards/${name}.json`
    ),
    "utf8"
  );
  return JSON.parse(board);
};

describe("function-calling/functionSignatureFromBoardFunction", () => {
  test("throws when no board is supplied", () => {
    throws(() => {
      functionSignatureFromBoardFunction({});
    });
  });
  test("throws when no inputs are found", () => {
    const board = {};
    throws(() => {
      functionSignatureFromBoardFunction({
        board,
      });
    });
  });
  test("throws when no outputs are found", () => {
    const board = {
      nodes: [
        {
          id: "node-1",
          type: "input",
        },
      ],
      edges: [],
    } satisfies GraphDescriptor;
    throws(() => {
      functionSignatureFromBoardFunction({
        board,
      });
    });
  });
  test("throws when no input schema is found", () => {
    const board = {
      nodes: [
        {
          id: "node-1",
          type: "input",
          configuration: {},
        },
        {
          id: "node-1",
          type: "output",
          configuration: {},
        },
      ],
      edges: [],
    } satisfies GraphDescriptor;
    throws(() => {
      functionSignatureFromBoardFunction({
        board,
      });
    });
  });

  test("returns function signature and return values", async () => {
    const board = await loadBoard("next-public-holiday");
    const result = functionSignatureFromBoardFunction({
      board,
    });
    deepStrictEqual(result, {
      function: {
        name: "Nager_Date_Next_Public_Holiday",
        description: "Get the next public holiday for a given country",
        parameters: {
          type: "object",
          properties: {
            countryCode: {
              type: "string",
              description: "Two-letter country code",
            },
          },
        },
      },
      returns: {
        type: "object",
        properties: {
          holidays: {
            description: "A list of public holidays for the given country",
            title: "Holidays",
            type: ["array", "boolean", "null", "number", "object", "string"],
          },
        },
        required: ["holidays"],
      },
    });
  });
});

test("substitutes property title for description when description is missing", async () => {
  const board = await loadBoard("no-descriptions");
  const result = functionSignatureFromBoardFunction({
    board,
  }) as { function: Record<string, unknown> };
  deepStrictEqual(result.function.parameters, {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "text",
      },
    },
  });
});

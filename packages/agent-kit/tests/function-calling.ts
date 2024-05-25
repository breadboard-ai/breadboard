/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import {
  FunctionCallFlags,
  URLMap,
  boardInvocationAssemblerFunction,
  functionOrTextRouterFunction,
  functionSignatureFromBoardFunction,
  resultFormatterFunction,
} from "../src/function-calling.js";
import { deepStrictEqual, throws } from "node:assert";
import { FunctionCallPart, LlmContent } from "../src/context.js";
import { GraphDescriptor } from "@google-labs/breadboard";
import { readFile } from "node:fs/promises";
import { resolve } from "path";

describe("function-calling/functionOrTextRouterFunction", () => {
  test("throws when no context is supplied", () => {
    throws(() => {
      functionOrTextRouterFunction({});
    });
  });

  test("throws when no text or function call is found", () => {
    throws(() => {
      functionOrTextRouterFunction({
        context: {
          parts: [],
        },
      });
    });
  });

  test("handles text", () => {
    const context = {
      parts: [{ text: "Hello" }],
    };
    const result = functionOrTextRouterFunction({
      context,
    });
    deepStrictEqual(result, { context, text: "Hello" });
  });

  test("handles function call", () => {
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
      functionCalls: [
        {
          name: "Get_Web_Page_Content",
          args: {
            url: "https://example.com/",
          },
        },
      ],
    });
  });

  test("handles multiple parts", () => {
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
        functionCalls: [
          {
            name: "Get_Web_Page_Content",
            args: {
              url: "https://example.com/",
            },
          },
        ],
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
        functionCalls: [
          {
            name: "Get_Web_Page_Content",
            args: {
              url: "https://example.com/",
            },
          },
        ],
      });
    }
  });

  test("handles multiple function calls", () => {
    const functionCall1 = {
      name: "Get_Web_Page_Content",
      args: {
        url: "https://example.com/",
      },
    };
    const functionCall2 = {
      name: "Get_Next_Holiday",
      args: {
        country: "LT",
      },
    };
    const context = {
      parts: [{ functionCall: functionCall1 }, { functionCall: functionCall2 }],
    };
    const result = functionOrTextRouterFunction({ context });
    deepStrictEqual(result, {
      context,
      functionCalls: [functionCall1, functionCall2],
    });
  });
});

describe("function-calling/boardInvocationAssembler", () => {
  test("throws when the args are missing", () => {
    throws(() => {
      boardInvocationAssemblerFunction({});
    }, 'Must have "functionCalls".');
    throws(() => {
      boardInvocationAssemblerFunction({ functionCalls: [] });
    }, 'Must have "urlMap"');
    throws(() => {
      boardInvocationAssemblerFunction({ functionCalls: [], urlMap: {} });
    }, "Function call array must not be empty");
  });

  test("correctly packs the invocation args", () => {
    const functionCalls = [
      {
        name: "Get_Web_Page_Content",
        args: { url: "https://example.com/" },
      },
      {
        name: "Get_Next_Holiday",
        args: {
          country: "LT",
        },
      },
    ] satisfies FunctionCallPart["functionCall"][];
    const urlMap = {
      Get_Web_Page_Content: { url: "get/web/page", flags: {} },
      Get_Next_Holiday: { url: "get/next/holiday", flags: {} },
    } satisfies URLMap;
    const result = boardInvocationAssemblerFunction({ functionCalls, urlMap });
    deepStrictEqual(result, {
      list: [
        { $board: "get/web/page", url: "https://example.com/", $flags: {} },
        { $board: "get/next/holiday", country: "LT", $flags: {} },
      ],
    });
  });
});

describe("function-calling/resultFormatterFunction", () => {
  test("correctly outputs LLMContent for simple outputs", () => {
    {
      const result = { data: "foo" };
      const output = resultFormatterFunction({ result, flags: {} });
      deepStrictEqual(output, {
        item: [{ parts: [{ text: JSON.stringify(result) }], role: "tool" }],
      });
    }
    {
      const result = { data: null };
      const output = resultFormatterFunction({ result, flags: {} });
      deepStrictEqual(output, {
        item: [{ parts: [{ text: JSON.stringify(result) }], role: "tool" }],
      });
    }
  });
  test("correctly detect LLMContent inside (old way)", () => {
    {
      const result = { out: { content: "foo" } };
      const output = resultFormatterFunction({ result });
      deepStrictEqual(output, {
        item: [{ parts: [{ text: JSON.stringify(result) }], role: "tool" }],
      });
    }
    {
      const result = {
        out: {
          content: { parts: [{ text: "hello" }], role: "something" },
        },
      };
      const output = resultFormatterFunction({ result });
      deepStrictEqual(output, {
        item: [{ parts: result.out.content.parts, role: "tool" }],
      });
    }
  });
  test("correctly detect LLMContent inside using flags", () => {
    {
      const llmContent: LlmContent = { parts: [{ text: "hello" }] };
      const result = { out: llmContent };
      const output = resultFormatterFunction({
        result,
        flags: { outputLLMContent: "out" },
      });
      deepStrictEqual(output, {
        item: [{ parts: [{ text: "hello" }], role: "tool" }],
      });
    }
    {
      const llmContentArray: LlmContent[] = [
        { parts: [{ text: "hello" }] },
        { parts: [{ text: "world" }] },
      ];
      const result = { out: llmContentArray };
      const output = resultFormatterFunction({
        result,
        flags: { outputLLMContentArray: "out" },
      });
      deepStrictEqual(output, {
        item: [
          { parts: [{ text: "hello" }], role: "tool" },
          { parts: [{ text: "world" }], role: "tool" },
        ],
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
      flags: {},
    });
  });

  test("recognizes and flags LLM content", async () => {
    const board = await loadBoard("holiday-researcher");
    const result = functionSignatureFromBoardFunction({
      board,
    }) as { flags: FunctionCallFlags };
    deepStrictEqual(result.flags, {
      inputLLMContent: "text",
      outputLLMContent: "text",
    });
  });

  test("recognizes and flags LLM content arrays", async () => {
    const board = await loadBoard("llm-content-array");
    const result = functionSignatureFromBoardFunction({
      board,
    }) as { flags: FunctionCallFlags };
    deepStrictEqual(result.flags, {
      inputLLMContentArray: "text",
      outputLLMContentArray: "text",
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
});

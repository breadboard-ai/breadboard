/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import {
  FunctionCallFlags,
  ToolResponse,
  URLMap,
  boardInvocationAssemblerFunction,
  functionOrTextRouterFunction,
  functionSignatureFromBoardFunction,
  responseCollatorFunction,
  resultFormatterFunction,
} from "../src/function-calling.js";
import { deepStrictEqual, ok, throws } from "node:assert";
import {
  FunctionCallPart,
  LlmContent,
  splitStartAdderFunction,
} from "../src/context.js";
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

  test("correctly packs the invocation args with flags", () => {
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
      Get_Web_Page_Content: {
        url: "get/web/page",
        flags: { inputLLMContent: "url" },
      },
      Get_Next_Holiday: {
        url: "get/next/holiday",
        flags: { outputLLMContent: "holidays" },
      },
    } satisfies URLMap;
    const result = boardInvocationAssemblerFunction({ functionCalls, urlMap });
    deepStrictEqual(result, {
      list: [
        {
          $board: "get/web/page",
          url: { parts: [{ text: "https://example.com/" }], role: "user" },
          $flags: { inputLLMContent: "url" },
        },
        {
          $board: "get/next/holiday",
          country: "LT",
          $flags: { outputLLMContent: "holidays" },
        },
      ],
    });
  });

  test("correctly packs the invocation args with array input flag", () => {
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
      Get_Web_Page_Content: {
        url: "get/web/page",
        flags: { inputLLMContentArray: "url" },
      },
      Get_Next_Holiday: {
        url: "get/next/holiday",
        flags: { outputLLMContent: "holidays" },
      },
    } satisfies URLMap;
    const result = boardInvocationAssemblerFunction({ functionCalls, urlMap });
    deepStrictEqual(result, {
      list: [
        {
          $board: "get/web/page",
          url: [{ parts: [{ text: "https://example.com/" }], role: "user" }],
          $flags: { inputLLMContentArray: "url" },
        },
        {
          $board: "get/next/holiday",
          country: "LT",
          $flags: { outputLLMContent: "holidays" },
        },
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

  test("handles boards with no inputs", async () => {
    const board = await loadBoard("today");
    const result = functionSignatureFromBoardFunction({
      board,
    });
    deepStrictEqual(result.board, board);
    delete result.board;
    deepStrictEqual(result, {
      function: {
        name: "Get_Today",
        description: "Return today's date",
      },
      returns: {
        type: "object",
        properties: {
          today: {
            title: "Today",
            type: "string",
            examples: [],
          },
        },
        required: [],
      },
      flags: {},
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
    deepStrictEqual(result.board, board);
    delete result.board;
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

  // test("substitutes property title for description when description is missing", async () => {
  //   const board = await loadBoard("no-descriptions");
  //   const result = functionSignatureFromBoardFunction({
  //     board,
  //   }) as { function: Record<string, unknown> };
  //   deepStrictEqual(result.function.parameters, {
  //     type: "object",
  //     properties: {
  //       text: {
  //         type: "string",
  //         description: "text",
  //       },
  //     },
  //   });
  // });

  test("elides property named `context` from args", async () => {
    const board = await loadBoard("context-arg");
    const result = functionSignatureFromBoardFunction({
      board,
    }) as { function: Record<string, unknown> };
    ok(!result.function.parameters);
  });

  test("renames the arg named `context` to match property name", async () => {
    const board = await loadBoard("context-arg");
    const result = functionSignatureFromBoardFunction({
      board,
    }) as { board: GraphDescriptor };
    ok(result.board.args?.["property-1"]);
  });
});

describe("function-calling/responseCollator", () => {
  const hello: LlmContent = { parts: [{ text: "Hello" }], role: "tool" };
  const world: LlmContent = { parts: [{ text: "World" }], role: "tool" };
  const howdy: LlmContent = { parts: [{ text: "Howdy" }], role: "tool" };
  const realm: LlmContent = { parts: [{ text: "Realm" }], role: "tool" };
  test("correctly collates responses", () => {
    const response = [
      { item: [hello, world] },
      { item: [howdy, realm] },
    ] satisfies ToolResponse[];
    const result = responseCollatorFunction({ response });
    deepStrictEqual(result, {
      "context-1": [hello, world],
      "context-2": [howdy, realm],
    });
  });
  test("correctly adds context", () => {
    const context: LlmContent[] = [hello, world];
    const response = [{ item: [howdy, realm] }] satisfies ToolResponse[];
    const result = responseCollatorFunction({ response, context });
    deepStrictEqual(result, {
      "context-0": [hello, world],
      "context-1": [howdy, realm],
    });
  });
});

describe("function-calling/addSplitStart", () => {
  test("correctly adds split start", () => {
    const hello: LlmContent = { parts: [{ text: "Hello" }], role: "tool" };
    const context: LlmContent[] = [hello];
    const result = splitStartAdderFunction({
      context,
    });
    const c = result.context as LlmContent[];
    ok(c.length === 2);
    ok(result.id !== null);
    const id = result.id;
    deepStrictEqual(c[1], {
      role: "$metadata",
      type: "split",
      data: {
        id,
        type: "start",
      },
    });
  });
});

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import {
  URLMap,
  boardInvocationAssemblerFunction,
  functionOrTextRouterFunction,
  toolResponseFormatterFunction,
} from "../src/function-calling.js";
import { deepStrictEqual, throws } from "node:assert";
import { FunctionCallPart } from "../src/context.js";

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
      Get_Web_Page_Content: "get/web/page",
      Get_Next_Holiday: "get/next/holiday",
    } satisfies URLMap;
    const result = boardInvocationAssemblerFunction({ functionCalls, urlMap });
    deepStrictEqual(result, {
      list: [
        { $board: "get/web/page", url: "https://example.com/" },
        { $board: "get/next/holiday", country: "LT" },
      ],
    });
  });
});

describe("function-calling/toolResponseFormatter", () => {
  test("detects invalid response", () => {
    throws(() => {
      const response = [{ data: "foo" }];
      toolResponseFormatterFunction({ response });
    }, 'Must have "item"');
  });

  test("correctly outputs LLMContent for simple outputs", () => {
    {
      const response = [{ item: { data: "foo" } }];
      const result = toolResponseFormatterFunction({ response });
      deepStrictEqual(result, {
        response: [
          { parts: [{ text: JSON.stringify(response[0].item) }], role: "tool" },
        ],
      });
    }
    {
      const response = [{ item: { data: null } }];
      const result = toolResponseFormatterFunction({ response });
      deepStrictEqual(result, {
        response: [
          { parts: [{ text: JSON.stringify(response[0].item) }], role: "tool" },
        ],
      });
    }
    {
      const response = [{ item: { data: "foo" } }, { item: { bar: "baz" } }];
      const result = toolResponseFormatterFunction({ response });
      deepStrictEqual(result, {
        response: [
          { parts: [{ text: JSON.stringify(response[0].item) }], role: "tool" },
          { parts: [{ text: JSON.stringify(response[1].item) }], role: "tool" },
        ],
      });
    }
  });
  test("correctly detect LLMContent inside", () => {
    {
      const response = [{ item: { out: { content: "foo" } } }];
      const result = toolResponseFormatterFunction({ response });
      deepStrictEqual(result, {
        response: [
          { parts: [{ text: JSON.stringify(response[0].item) }], role: "tool" },
        ],
      });
    }
    {
      const response = [
        {
          item: {
            out: {
              content: { parts: [{ text: "hello" }], role: "something" },
            },
          },
        },
      ];
      const result = toolResponseFormatterFunction({ response });
      deepStrictEqual(result, {
        response: [{ parts: response[0].item.out.content.parts, role: "tool" }],
      });
    }
  });
});

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { functionOrTextRouterFunction } from "../src/function-calling.js";
import { deepStrictEqual, throws } from "node:assert";

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

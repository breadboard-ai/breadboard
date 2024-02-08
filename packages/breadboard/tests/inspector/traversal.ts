/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// These test traversal of the inspector API.

import test from "ava";

import { loadToInspect } from "../../src/inspector/index.js";

const BASE_URL = new URL("../../../tests/inspector/data/", import.meta.url);

const load = async (url: string) => {
  const base = BASE_URL;
  const loader = loadToInspect(base);
  return loader(url, { nodes: [], edges: [] });
};

test("inspector API can traverse simplest.json", async (t) => {
  const simplest = await load("simplest.json");
  // This is mostly to avoid needing to do `graph?` everywhere.
  if (!simplest) {
    return t.fail("Graph is undefined");
  }
  t.assert(simplest.nodes().length == 3, "The graph has three nodes");

  const entries = simplest.entries();
  t.assert(entries.length == 1, "The graph has one entry");

  const input = entries[0];
  t.assert(input.descriptor.type == "input", "The entry is an input");

  const fromInput = input.outgoing();
  t.assert(fromInput.length == 1, "The input has one outgoing edge");

  const invoke = fromInput[0].to;
  t.assert(invoke.descriptor.type == "invoke", "The next node is an invoke");
  t.assert(invoke.isSubgraph(), "The invoke is a subgraph");

  const geminiGenerator = await invoke.subgraph(loadToInspect(BASE_URL));
  if (!geminiGenerator) {
    return t.fail("Subgraph is undefined");
  }
  t.is(geminiGenerator.nodes().length, 11, "The subgraph has eleven nodes");

  const fromInvoke = invoke.outgoing();
  t.assert(fromInvoke.length == 1, "The invoke has one outgoing edge");

  const output = fromInvoke[0].to;
  t.assert(output.descriptor.type == "output", "The next node is an output");
  t.assert(output.isExit(), "The output is an exit node");
});

test("inspector API can describe the subgraph in simplest-no-schema.json", async (t) => {
  const simplest = await load("simplest-no-schema.json");
  if (!simplest) {
    return t.fail("Graph is undefined");
  }
  const invoke = simplest.nodesByType("invoke")[0];

  const geminiGenerator = await invoke.subgraph(loadToInspect(BASE_URL));

  const api = await geminiGenerator?.describe();

  t.deepEqual(api, {
    inputSchema: {
      type: "object",
      properties: { useStreaming: { type: "string" } },
      required: ["useStreaming"],
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: {
        stream: { type: "string" },
        context: { type: "string" },
        text: { type: "string" },
        toolCalls: { type: "string" },
      },
      required: ["context", "stream", "text", "toolCalls"],
      additionalProperties: false,
    },
  });
});

test("inspector API can describe the subgraph in simplest.json", async (t) => {
  const simplest = await load("simplest.json");
  if (!simplest) {
    return t.fail("Graph is undefined");
  }
  const invoke = simplest.nodesByType("invoke")[0];

  const geminiGenerator = await invoke.subgraph(loadToInspect(BASE_URL));

  const api = await geminiGenerator?.describe();

  t.deepEqual(api, {
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Text",
          description: "The text to generate",
          examples: ["What is the square root of pi?"],
        },
        tools: {
          type: "array",
          title: "Tools",
          description: "An array of functions to use for tool-calling",
          items: {
            type: "string",
          },
          default: "[]",
          examples: [
            '[\n  {\n    "name": "The_Calculator_Board",\n    "description": "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",\n    "parameters": {\n      "type": "object",\n      "properties": {\n        "text": {\n          "type": "string",\n          "description": "Ask a math question"\n        }\n      },\n      "required": [\n        "text"\n      ]\n    }\n  },\n  {\n    "name": "The_Search_Summarizer_Board",\n    "description": "A simple AI pattern that first uses Google Search to find relevant bits of information and then summarizes them using LLM.",\n    "parameters": {\n      "type": "object",\n      "properties": {\n        "text": {\n          "type": "string",\n          "description": "What would you like to search for?"\n        }\n      },\n      "required": [\n        "text"\n      ]\n    }\n  }\n]',
          ],
        },
        context: {
          type: "array",
          title: "Context",
          description: "An array of messages to use as conversation context",
          items: {
            type: "object",
          },
          default: "[]",
          examples: [
            '[\n  {\n    "role": "user",\n    "parts": [\n      {\n        "text": "You are a pirate. Please talk like a pirate."\n      }\n    ]\n  },\n  {\n    "role": "model",\n    "parts": [\n      {\n        "text": "Arr, matey!"\n      }\n    ]\n  }\n]',
          ],
        },
        useStreaming: {
          type: "boolean",
          title: "Stream",
          description: "Whether to stream the output",
          default: "false",
        },
        stopSequences: {
          type: "array",
          title: "Stop Sequences",
          description: "An array of strings that will stop the output",
          items: {
            type: "string",
          },
          default: "[]",
        },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Text",
          description: "The generated text",
        },
        toolCalls: {
          type: "array",
          title: "Tool Calls",
          description: "The generated tool calls",
        },
        stream: {
          type: "object",
          title: "Stream",
          format: "stream",
          description: "The generated text",
        },
        context: {
          type: "array",
          title: "Context",
          description: "The conversation context",
        },
      },
    },
  });
});

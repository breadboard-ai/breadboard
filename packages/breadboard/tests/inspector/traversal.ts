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
      properties: { useStreaming: { type: "string" }, "*": { type: "string" } },
      additionalProperties: false,
      required: ["*", "useStreaming"],
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        stream: { type: "string" },
        context: { type: "string" },
        text: { type: "string" },
        toolCalls: { type: "string" },
      },
      required: ["context", "stream", "text", "toolCalls"],
    },
  });
});

test("inspector API can describe the input in simplest.json", async (t) => {
  const simplest = await load("simplest.json");
  if (!simplest) {
    return t.fail("Graph is undefined");
  }
  const input = simplest.nodesByType("input")[0];

  const api = await input.describe();

  t.deepEqual(api, {
    inputSchema: {
      type: "object",
      properties: {
        text: {
          description: "The prompt to generate a completion for",
          examples: ["Tell me a fun story about playing with breadboards"],
          title: "Prompt",
          type: "string",
        },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
      properties: {
        text: {
          description: "The prompt to generate a completion for",
          examples: ["Tell me a fun story about playing with breadboards"],
          title: "Prompt",
          type: "string",
        },
      },
      required: ["text"],
    },
  });
});

test("inspector API can describe the input in simplest-no-schema.json", async (t) => {
  const simplest = await load("simplest-no-schema.json");
  if (!simplest) {
    return t.fail("Graph is undefined");
  }
  const input = simplest.nodesByType("input")[0];

  const api = await input.describe();

  t.deepEqual(api, {
    inputSchema: {
      type: "object",
      properties: {},
    },
    outputSchema: {
      type: "object",
      properties: {},
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
      properties: { useStreaming: { type: "string" }, "*": { type: "string" } },
      additionalProperties: false,
      required: ["*", "useStreaming"],
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        stream: { type: "string" },
        context: { type: "string" },
        text: { type: "string" },
        toolCalls: { type: "string" },
      },
      required: ["context", "stream", "text", "toolCalls"],
    },
  });
});

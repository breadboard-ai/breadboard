/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphTag } from "@breadboard-ai/types";
import { GraphDescriptor, Schema } from "../types.js";

const llmContentConfig = (type: string) => ({
  schema: {
    properties: {
      context: {
        type: "array",
        title: "Context",
        items: {
          type: "object",
          behavior: ["llm-content"],
        },
        default:
          type === "input" ? '[{"role":"user","parts":[{"text":""}]}]' : "null",
      },
    },
    type: "object",
    required: [],
  } satisfies Schema,
});

const BLANK_GRAPH: GraphDescriptor = {
  title: "Untitled Flow",
  description: "Add a description",
  version: "0.0.1",
  nodes: [],
  edges: [],
};

const BLANK_LLM_CONTENT_GRAPH: GraphDescriptor = {
  title: "Untitled Flow",
  description: "Add a description",
  version: "0.0.1",
  nodes: [
    { type: "input", id: "input", configuration: llmContentConfig("input") },
    { type: "output", id: "output", configuration: llmContentConfig("output") },
  ],
  edges: [{ from: "input", out: "context", to: "output", in: "context" }],
};

/**
 * Creates a `GraphDescriptor` of a blank graph.
 */
export const blank = (): GraphDescriptor => {
  return structuredClone(BLANK_GRAPH);
};

/**
 * Creates a `GraphDescriptor` of a blank graph with inputs/outputs pre-set
 * to the LLM content array schema.
 */
export const blankLLMContent = (...tags: GraphTag[]): GraphDescriptor => {
  const graph = structuredClone(BLANK_LLM_CONTENT_GRAPH);
  if (tags.length) {
    graph.metadata = { tags };
  }
  return graph;
};

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";

const CONFIGURATION = {
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "text",
      },
    },
  },
};

const BLANK_GRAPH: GraphDescriptor = {
  title: "Blank board",
  description: "A blank board. Use it as a starting point for your creations.",
  version: "0.0.1",
  nodes: [
    { type: "input", id: "input", configuration: CONFIGURATION },
    { type: "output", id: "output", configuration: CONFIGURATION },
  ],
  edges: [{ from: "input", out: "text", to: "output", in: "text" }],
};

/**
 * Creates a `GraphDescriptor` of a blank graph.
 */
export const blank = (): GraphDescriptor => {
  return structuredClone(BLANK_GRAPH);
};

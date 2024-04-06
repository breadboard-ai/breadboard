/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "../types.js";
import { Graph } from "./graph.js";
import { EditableGraph, EditableGraphOptions } from "./types.js";

const BLANK_GRAPH: GraphDescriptor = {
  title: "Blank board",
  description: "A blank board. Use it as a starting point for your creations.",
  version: "0.0.1",
  nodes: [],
  edges: [],
};

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

const config = () => structuredClone(CONFIGURATION);

/**
 * Creates an `EditableGraph` instance of a blank graph.
 */
export const editBlank = async (
  options: EditableGraphOptions = {}
): Promise<EditableGraph> => {
  const graph = new Graph(structuredClone(BLANK_GRAPH), options);
  await graph.addNode({ id: "input", type: "input", configuration: config() });
  await graph.addNode({
    id: "output",
    type: "output",
    configuration: config(),
  });
  await graph.addEdge({ from: "input", out: "text", to: "output", in: "text" });
  return graph;
};

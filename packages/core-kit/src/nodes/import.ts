/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchemaBuilder } from "@google-labs/breadboard/kits";
import type {
  InputValues,
  BreadboardCapability,
  NodeHandlerContext,
  GraphDescriptor,
  OutputValues,
  GraphLoaderResult,
} from "@google-labs/breadboard";
import { loadGraphFromPath } from "../utils.js";

export type ImportNodeInputs = InputValues & {
  path?: string;
  graph?: GraphDescriptor;
  args: InputValues;
};

export default {
  metadata: {
    deprecated: true,
  },
  describe: async (inputs?: InputValues) => {
    return {
      inputSchema: new SchemaBuilder()
        .addInputs(inputs)
        .addProperties({
          path: {
            title: "path",
            description: "The path to the board to import.",
            type: "string",
          },
          graph: {
            title: "graph",
            description: "The graph descriptor of the board to import.",
            type: "object",
          },
        })
        .setAdditionalProperties(true)
        .build(),
      outputSchema: new SchemaBuilder().addProperties({
        board: {
          title: "board",
          description: "The imported board.",
          type: "object",
        },
      }),
    };
  },
  invoke: async (
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
    const { path, graph, ...args } = inputs as ImportNodeInputs;

    const result: GraphLoaderResult | undefined = graph
      ? { success: true, graph }
      : path
        ? await loadGraphFromPath(path, context)
        : undefined;
    if (!result?.success) throw Error("No board provided");
    const board = result.graph;
    board.args = args;

    return { board: { kind: "board", board } as BreadboardCapability };
  },
};

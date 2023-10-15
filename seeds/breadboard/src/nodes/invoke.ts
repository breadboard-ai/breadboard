/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  IncludeNodeInputs,
  NodeHandlerContext,
} from "../types.js";
import { Board } from "../board.js";
import { SchemaBuilder } from "../schema.js";

export default {
  describe: async (inputs?: InputValues) => ({
    inputSchema: new SchemaBuilder()
      .setAdditionalProperties(true)
      .addInputs(inputs)
      .addProperties({
        path: {
          title: "path",
          description: "The path to the board to invoke.",
          type: "string",
        },
        $ref: {
          title: "$ref",
          description: "The $ref to the board to invoke.",
          type: "string",
        },
        graph: {
          title: "graph",
          description: "The graph descriptor of the board to invoke.",
          type: "object",
        },
      })
      .build(),
    outputSchema: new SchemaBuilder().setAdditionalProperties(true).build(),
  }),
  invoke: async (
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
    const { path, board, graph, ...args } = inputs as IncludeNodeInputs;

    const runnableBoard = board
      ? await Board.fromBreadboardCapability(board)
      : graph
      ? await Board.fromGraphDescriptor(graph)
      : path
      ? await Board.load(path, {
          base: context.board.url,
          outerGraph: context.parent,
        })
      : undefined;

    if (!runnableBoard) throw new Error("No board provided");

    return await runnableBoard.runOnce(args, context);
  },
};

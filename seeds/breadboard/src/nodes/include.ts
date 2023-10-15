/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  BreadboardSlotSpec,
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
          description: "The path to the board to include.",
          type: "string",
        },
        $ref: {
          title: "$ref",
          description: "The $ref to the board to include.",
          type: "string",
        },
        graph: {
          title: "graph",
          description: "The graph descriptor of the board to include.",
          type: "object",
        },
        slotted: {
          title: "slotted",
          description: "The slotted graphs to include.",
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
    const { path, $ref, board, graph, slotted, ...args } =
      inputs as IncludeNodeInputs;

    // Add the current graph's URL as the url of the slotted graph,
    // if there isn't an URL already.
    const slottedWithUrls: BreadboardSlotSpec = {};
    if (slotted) {
      for (const key in slotted) {
        slottedWithUrls[key] = { url: context.board.url, ...slotted[key] };
      }
    }

    // TODO: Please fix the $ref/path mess.
    const source = path || $ref || "";

    const runnableBoard = board
      ? await Board.fromBreadboardCapability(board)
      : graph
      ? await Board.fromGraphDescriptor(graph)
      : await Board.load(source, {
          slotted: slottedWithUrls,
          base: context.board.url,
          outerGraph: context.parent,
        });

    return await runnableBoard.runOnce(args, context);
  },
};

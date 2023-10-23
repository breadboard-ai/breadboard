/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  NodeHandlerContext,
  BreadboardCapability,
  GraphDescriptor,
} from "@google-labs/breadboard";
import { BoardRunner } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";

export type InvokeNodeInputs = InputValues & {
  path?: string;
  board?: BreadboardCapability;
  graph?: GraphDescriptor;
};

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
          title: "board",
          description: "The board to invoke, created by `lambda` or `import`",
          type: "BoardCapability",
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
    const { path, board, graph, ...args } = inputs as InvokeNodeInputs;

    const runnableBoard = board
      ? await BoardRunner.fromBreadboardCapability(board, context.kits)
      : graph
      ? await BoardRunner.fromGraphDescriptor(graph, context.kits)
      : path
      ? await BoardRunner.load(path, {
          base: context.base,
          outerGraph: context.outerGraph,
          kits: context.kits,
        })
      : undefined;

    if (!runnableBoard) throw new Error("No board provided");

    return await runnableBoard.runOnce(args, context);
  },
};

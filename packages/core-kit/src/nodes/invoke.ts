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
  $recipe?: string | BreadboardCapability | GraphDescriptor;
  path?: string;
  board?: BreadboardCapability;
  graph?: GraphDescriptor;
};

const getRunnableBoard = async (
  { base, outerGraph }: NodeHandlerContext,
  path?: string,
  board?: BreadboardCapability,
  graph?: GraphDescriptor
): Promise<BoardRunner | undefined> => {
  if (board) return await BoardRunner.fromBreadboardCapability(board);
  if (graph) return await BoardRunner.fromGraphDescriptor(graph);
  if (path) {
    return await BoardRunner.load(path, { base, outerGraph });
  }
  return undefined;
};

const isBreadboardCapability = (
  candidate: unknown
): candidate is BreadboardCapability => {
  const board = candidate as BreadboardCapability;
  return (
    board &&
    typeof board === "object" &&
    board.kind === "board" &&
    board.board &&
    isGraphDescriptor(board.board)
  );
};

const isGraphDescriptor = (
  candidate: unknown
): candidate is GraphDescriptor => {
  const graph = candidate as GraphDescriptor;
  return (
    graph && typeof graph === "object" && graph.nodes && graph.edges && true
  );
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
        board: {
          title: "board",
          description: "The board to invoke, created by `lambda` or `import`",
          type: "BoardCapability",
        },
        graph: {
          title: "graph",
          description: "The graph descriptor of the board to invoke.",
          type: "object",
        },
        $recipe: {
          title: "recipe",
          description:
            "The recipe to invoke. Can be a BoardCapability, a graph or a URL",
          type: "string", // TODO: Make this a union type
        },
      })
      .build(),
    outputSchema: new SchemaBuilder().setAdditionalProperties(true).build(),
  }),
  invoke: async (
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
    const { $recipe, ...args } = inputs as InvokeNodeInputs;

    if ($recipe) {
      let board;

      if (isBreadboardCapability($recipe))
        board = await BoardRunner.fromBreadboardCapability($recipe);
      if (isGraphDescriptor($recipe))
        board = await BoardRunner.fromGraphDescriptor($recipe);
      if (typeof $recipe === "string") {
        board = await BoardRunner.load($recipe, context);
      } else {
        board = undefined;
      }

      if (!board) throw new Error("No board provided");

      return await board.runOnce(args, context);
    } else {
      const { path, board, graph, ...args } = inputs as InvokeNodeInputs;

      const runnableBoard = await getRunnableBoard(context, path, board, graph);
      if (!runnableBoard) throw new Error("No board provided");

      return await runnableBoard.runOnce(args, context);
    }
  },
};

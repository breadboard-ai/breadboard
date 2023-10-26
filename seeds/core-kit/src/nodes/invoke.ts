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
  KitConstructor,
  Kit,
} from "@google-labs/breadboard";
import { BoardRunner } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";

export type InvokeNodeInputs = InputValues & {
  path?: string;
  board?: BreadboardCapability;
  graph?: GraphDescriptor;
};

const skipLoadingKits = (kits: Kit[]) => {
  return Object.fromEntries(
    kits.map((kit) => {
      const url = new URL(kit.url).pathname;
      return [url, null as unknown as KitConstructor<Kit>];
    })
  );
};

const getRunnableBoard = async (
  { base, outerGraph, kits }: NodeHandlerContext,
  path?: string,
  board?: BreadboardCapability,
  graph?: GraphDescriptor
): Promise<BoardRunner | undefined> => {
  if (board) return await BoardRunner.fromBreadboardCapability(board);
  if (graph) return await BoardRunner.fromGraphDescriptor(graph);
  if (path) {
    const importedKits = skipLoadingKits(kits || []);
    return await BoardRunner.load(path, { base, outerGraph, importedKits });
  }
  return undefined;
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

    const runnableBoard = await getRunnableBoard(context, path, board, graph);
    if (!runnableBoard) throw new Error("No board provided");

    return await runnableBoard.runOnce(args, context);
  },
};

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardRunner } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";
import type {
  InputValues,
  BreadboardCapability,
  NodeHandlerContext,
  GraphDescriptor,
  LambdaNodeOutputs,
} from "@google-labs/breadboard";

export type ImportNodeInputs = InputValues & {
  path?: string;
  graph?: GraphDescriptor;
  args: InputValues;
};

export default {
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
  ): Promise<LambdaNodeOutputs> => {
    const { path, graph, ...args } = inputs as ImportNodeInputs;

    const board = graph
      ? (graph as BoardRunner).runOnce // TODO: Hack! Use JSON schema or so instead.
        ? ({ ...graph } as BoardRunner)
        : await BoardRunner.fromGraphDescriptor(graph)
      : path
      ? await BoardRunner.load(path, {
          base: context.base,
          outerGraph: context.outerGraph,
        })
      : undefined;
    if (!board) throw Error("No board provided");
    board.args = args;

    return { board: { kind: "board", board } as BreadboardCapability };
  },
};

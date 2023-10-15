/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "../board.js";
import { SchemaBuilder } from "../schema.js";
import type {
  InputValues,
  BreadboardCapability,
  ImportNodeInputs,
  LambdaNodeOutputs,
  NodeHandlerContext,
} from "../types.js";

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
          $ref: {
            title: "$ref",
            description: "The $ref to the board to import.",
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
    const { path, $ref, graph, ...args } = inputs as ImportNodeInputs;

    // TODO: Please fix the $ref/path mess.
    const source = path || $ref || "";
    const board = graph
      ? (graph as Board).runOnce // TODO: Hack! Use JSON schema or so instead.
        ? ({ ...graph } as Board)
        : await Board.fromGraphDescriptor(graph)
      : await Board.load(source, {
          base: context.board.url,
          outerGraph: context.parent,
        });
    board.args = args;

    return { board: { kind: "board", board } as BreadboardCapability };
  },
};

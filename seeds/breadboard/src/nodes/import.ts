/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "../board.js";
import type {
  InputValues,
  BreadboardCapability,
  ImportNodeInputs,
  LambdaNodeOutputs,
  NodeHandlerContext,
} from "../types.js";

export default async (
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
};

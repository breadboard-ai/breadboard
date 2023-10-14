/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, OutputValues } from "@google-labs/graph-runner";
import { IncludeNodeInputs, NodeHandlerContext } from "../types.js";
import { Board } from "../board.js";

export default async (
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
};

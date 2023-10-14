/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, InputValues } from "@google-labs/graph-runner";
import { LambdaNodeInputs, LambdaNodeOutputs } from "../types.js";
import { Board } from "../board.js";

export default async (inputs: InputValues): Promise<LambdaNodeOutputs> => {
  const { board, ...args } = inputs as LambdaNodeInputs;
  if (!board || board.kind !== "board" || !board.board)
    throw new Error(`Lambda node requires a BoardCapability as "board" input`);
  const runnableBoard = {
    ...(await Board.fromBreadboardCapability(board)),
    args,
  };

  return {
    board: { ...board, board: runnableBoard as GraphDescriptor },
  };
};

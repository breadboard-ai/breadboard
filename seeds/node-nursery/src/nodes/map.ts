/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capability,
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";

export type MapInputs = InputValues & {
  /**
   * The list to iterate over.
   */
  list: NodeValue[];

  /**
   * The board to run for each element of the list.
   */
  board?: Capability;
};

export type MapOutputs = OutputValues & {
  /**
   * The list of outputs from the board.
   */
  list: NodeValue[];
};

// TODO: This likely lives elsewhere, in breadboard perhaps?
export type RunnableBoard = {
  // TODO: Match Board.runOnce
  runOnce: (inputs: InputValues) => Promise<OutputValues>;
};

export type BoardCapability = Capability & {
  kind: "board";
  board: RunnableBoard;
};

// TODO: This likely lives elsewehere, in breadboard perhaps?
export const fromCapability = (board: Capability): RunnableBoard => {
  if (board.kind !== "board") {
    throw new Error(`Expected a "board" Capability, but got ${board}`);
  }
  return (board as BoardCapability).board;
};

export default async (inputs: InputValues): Promise<OutputValues> => {
  const { list, board } = inputs as MapInputs;
  if (!Array.isArray(list)) {
    throw new Error(`Expected list to be an array, but got ${list}`);
  }
  if (!board) return { list };
  const runnableBoard = fromCapability(board);
  const result = await Promise.all(
    list.map(async (item, index) => {
      // TODO: Express as a multi-turn `run`.
      const outputs = await runnableBoard.runOnce({ item, index, list });
      return outputs;
    })
  );
  return { list: result };
};

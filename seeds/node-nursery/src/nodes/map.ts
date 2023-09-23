/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Board,
  BreadboardNode,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";
import {
  Capability,
  GraphDescriptor,
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
export type RunnableBoard = GraphDescriptor & {
  // TODO: Match Board.runOnce
  runOnce: (inputs: InputValues) => Promise<OutputValues>;
  url?: string;
};

export type BoardCapability = Capability & {
  kind: "board";
  board: RunnableBoard;
};

export type LamdbdaFunction<In, Out> = (
  board: Board,
  input: BreadboardNode<In, Out>,
  output: BreadboardNode<In, Out>
) => Promise<void>;

export type LambdaResult = OptionalIdConfiguration & {
  board: BoardCapability;
};

export const lambda = async <In = InputValues, Out = OutputValues>(
  fun: LamdbdaFunction<In, Out>,
  config: OptionalIdConfiguration = {}
): Promise<LambdaResult> => {
  const board = new Board();
  const input = board.input<In>();
  const output = board.output<Out>();
  await fun(board, input, output);
  return {
    board: {
      kind: "board",
      board,
    } as BoardCapability, // TODO: Fix types.
    ...config,
  };
};

// TODO: This likely lives elsewehere, in breadboard perhaps?
export const fromCapability = async (
  board: Capability
): Promise<RunnableBoard> => {
  if (board.kind !== "board") {
    throw new Error(`Expected a "board" Capability, but got ${board}`);
  }
  // TODO: Use JSON schema to validate rather than this hack.
  const boardish = (board as BoardCapability)
    .board as unknown as GraphDescriptor;
  if (!(boardish.edges && boardish.kits && boardish.nodes)) {
    throw new Error(
      'Supplied "board" Capability argument is not actuall a board'
    );
  }
  let runnableBoard = (board as BoardCapability).board;
  if (!runnableBoard.runOnce) {
    runnableBoard = await Board.fromGraphDescriptor(boardish);
  }
  return runnableBoard;
};

export default async (inputs: InputValues): Promise<OutputValues> => {
  const { list, board } = inputs as MapInputs;
  if (!Array.isArray(list)) {
    throw new Error(`Expected list to be an array, but got ${list}`);
  }
  if (!board) return { list };
  const runnableBoard = await fromCapability(board);
  const result = await Promise.all(
    list.map(async (item, index) => {
      runnableBoard.url = inputs["$boardUrl"] as string;
      // TODO: Express as a multi-turn `run`.
      const outputs = await runnableBoard.runOnce({ item, index, list });
      return outputs;
    })
  );
  return { list: result };
};

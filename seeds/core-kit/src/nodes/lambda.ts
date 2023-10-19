/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreadboardCapability,
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@google-labs/breadboard";
import { Board } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";

export type LambdaNodeInputs = InputValues & {
  /**
   * The (lambda) board this node represents. The purpose of the this node is to
   * allow wiring data into the lambda board, outside of where it's called.
   * This is useful when passing a lambda to a map node or as a slot.
   *
   * Note that (for now) each board can only be represented by one node.
   */
  board: BreadboardCapability;

  /**
   * All other inputs will be bound to the board.
   */
  args: InputValues;
};

export type LambdaNodeOutputs = OutputValues & {
  /**
   * The lambda board that can be run.
   */
  board: BreadboardCapability;
};

export default {
  describe: async (inputs?: InputValues) => ({
    inputSchema: new SchemaBuilder()
      .setAdditionalProperties(true)
      .addInputs(inputs)
      .addProperty("board", {
        title: "board",
        description: "The board to run.",
        type: "object",
      })
      .build(),
    outputSchema: new SchemaBuilder()
      .addProperty("board", {
        title: "board",
        description: "The now-runnable board.",
        type: "object",
      })
      .build(),
  }),
  invoke: async (inputs: InputValues): Promise<LambdaNodeOutputs> => {
    const { board, ...args } = inputs as LambdaNodeInputs;
    if (!board || board.kind !== "board" || !board.board)
      throw new Error(
        `Lambda node requires a BoardCapability as "board" input`
      );
    const runnableBoard = {
      ...(await Board.fromBreadboardCapability(board)),
      args,
    };

    return {
      board: { ...board, board: runnableBoard as GraphDescriptor },
    };
  },
};

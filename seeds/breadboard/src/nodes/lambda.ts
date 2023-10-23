/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  LambdaNodeInputs,
  LambdaNodeOutputs,
} from "../types.js";
import { Board } from "../board.js";
import { SchemaBuilder } from "../schema.js";

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

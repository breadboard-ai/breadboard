/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capability,
  GraphDescriptor,
  InputValues,
  NodeValue,
  OutputValues,
  Board,
  BreadboardCapability,
  NodeHandlerContext,
  SchemaBuilder,
} from "@google-labs/breadboard";

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

const invoke = async (
  inputs: InputValues,
  context?: NodeHandlerContext
): Promise<OutputValues> => {
  const { list, board } = inputs as MapInputs;
  if (!Array.isArray(list)) {
    throw new Error(`Expected list to be an array, but got ${list}`);
  }
  if (!board) return { list };
  const runnableBoard = await Board.fromBreadboardCapability(
    board as BreadboardCapability
  );
  const result = await Promise.all(
    list.map(async (item, index) => {
      // TODO: Express as a multi-turn `run`.
      const newContext = {
        ...context,
        invocationPath: [...(context?.invocationPath || []), index],
      };
      const outputs = await runnableBoard.runOnce(
        { item, index, list },
        newContext
      );
      return outputs;
    })
  );
  return { list: result };
};

const describe = async () => {
  const inputSchema = new SchemaBuilder()
    .addProperty("list", {
      title: "List",
      type: "array",
      description: "The list to iterate over.",
    })
    .addProperty("board", {
      title: "Board",
      type: "object",
      description: "The board to run for each element of the list.",
    })
    .build();

  const outputSchema = new SchemaBuilder()
    .addProperty("list", {
      title: "List",
      type: "array",
      description: "The list of outputs from the board.",
    })
    .build();

  return { inputSchema, outputSchema };
};

export default { invoke, describe };

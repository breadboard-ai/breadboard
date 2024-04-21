/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  NodeValue,
  OutputValues,
  NodeHandlerContext,
  SchemaBuilder,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import { getRunner } from "../utils.js";

export type MapInputs = InputValues & {
  /**
   * The list to iterate over.
   */
  list: NodeValue[];

  /**
   * The board to run for each element of the list.
   */
  board?: unknown;
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
  context: NodeHandlerContext
): Promise<OutputValues> => {
  let { list } = inputs as MapInputs;
  const { board } = inputs as MapInputs;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch (e) {
      throw new Error(
        `List was a string, tried and failed parsing it: ${list}`
      );
    }
  }
  if (!Array.isArray(list)) {
    console.log("list", JSON.parse(list));
    throw new Error(`Expected list to be an array, but got ${list}`);
  }
  const runnableBoard = await getRunner(board, context);
  if (!runnableBoard) return { list };
  const result = await Promise.all(
    list.map(async (item, index) => {
      // TODO: Express as a multi-turn `run`.

      // If the current board has a URL, pass it as new base.
      // Otherwise, use the previous base.
      const base = context?.board?.url && new URL(context.board?.url);

      const newContext = {
        ...context,
        base: base || context?.base,
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
      behavior: ["board"],
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

const metadata = {
  title: "Map",
  description:
    "Given a list and a board, iterates over this list (just like your usual JavaScript `map` function), invoking (runOnce) the supplied board for each item.",
} satisfies NodeHandlerMetadata;

export default { metadata, invoke, describe };

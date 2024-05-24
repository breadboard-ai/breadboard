/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  NodeDescriberContext,
  NodeDescriberResult,
  NodeHandlerContext,
  NodeHandlerMetadata,
  NodeValue,
  OutputValues,
  Schema,
  SchemaBuilder,
  getGraphDescriptor,
  inspect,
} from "@google-labs/breadboard";

export type CurryInputs = {
  $board: unknown;
  [key: string]: unknown;
};

export type CurryOutputs = {
  board: unknown;
};

const invoke = async (
  inputs: InputValues,
  context: NodeHandlerContext
): Promise<OutputValues> => {
  const { $board, ...args } = inputs;

  const graph = await getGraphDescriptor($board, context);

  return { board: { ...graph, args } as NodeValue };
};

const describe = async (
  inputs?: InputValues,
  _in?: Schema,
  _out?: Schema,
  context?: NodeDescriberContext
): Promise<NodeDescriberResult> => {
  const inputBuilder = new SchemaBuilder().addProperties({
    $board: {
      title: "board",
      behavior: ["board"],
      description:
        "The board to curry. Can be a BoardCapability, a graph or a URL",
      type: "object",
    },
  });
  const outputBuilder = new SchemaBuilder()
    .setAdditionalProperties(false)
    .addProperty("board", {
      title: "board",
      behavior: ["board"],
      description: "The curried board as a graph descriptor",
      type: "object",
    });
  if (context?.base) {
    let board: GraphDescriptor | undefined;
    inputBuilder.setAdditionalProperties(true);
    if (inputs) {
      const { $board } = inputs;
      try {
        board = await getGraphDescriptor($board, context);
      } catch {
        // eat any exceptions.
        // This is a describer, so it must always return some valid value.
      }
      if (board) {
        const inspectableGraph = inspect(board);
        const { inputSchema } = await inspectableGraph.describe();
        inputBuilder.addProperties(inputSchema?.properties);
        inputBuilder.setAdditionalProperties(inputSchema.additionalProperties);
      }
    }
  }
  const inputSchema = inputBuilder.build();
  const outputSchema = outputBuilder.build();
  return { inputSchema, outputSchema };
};

const metadata = {
  title: "Curry",
  description:
    "Takes a board and bakes in (curries) supplied arguments into it. Very useful when we want to invoke a board with the same arguments many times (like with `map`).",
} satisfies NodeHandlerMetadata;

export default { metadata, invoke, describe };

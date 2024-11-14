/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  OutputValues,
  BreadboardSlotSpec,
  NodeHandlerContext,
  BreadboardCapability,
  GraphDescriptor,
} from "@google-labs/breadboard";
import { getGraphDescriptor, invokeGraph } from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";
import { loadGraphFromPath } from "../utils.js";

export type IncludeNodeInputs = InputValues & {
  path?: string;
  $ref?: string;
  board?: BreadboardCapability;
  graph?: GraphDescriptor;
  slotted?: BreadboardSlotSpec;
  args: InputValues;
};

export default {
  metadata: {
    deprecated: true,
  },
  describe: async (inputs?: InputValues) => ({
    inputSchema: new SchemaBuilder()
      .setAdditionalProperties(true)
      .addInputs(inputs)
      .addProperties({
        path: {
          title: "path",
          description: "The path to the board to include.",
          type: "string",
        },
        $ref: {
          title: "$ref",
          description: "The $ref to the board to include.",
          type: "string",
        },
        graph: {
          title: "graph",
          description: "The graph descriptor of the board to include.",
          type: "object",
        },
        slotted: {
          title: "slotted",
          description: "The slotted graphs to include.",
          type: "object",
        },
      })
      .build(),
    outputSchema: new SchemaBuilder().setAdditionalProperties(true).build(),
  }),
  invoke: async (
    inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
    const { path, $ref, board, graph, slotted, ...args } =
      inputs as IncludeNodeInputs;

    // Add the current graph's URL as the url of the slotted graph,
    // if there isn't an URL already.
    const slottedWithUrls: BreadboardSlotSpec = {};
    if (slotted) {
      for (const key in slotted) {
        slottedWithUrls[key] = { url: context.base?.href, ...slotted[key] };
      }
    }

    // TODO: Please fix the $ref/path mess.
    const source = path || $ref || "";

    const runnableBoard = board
      ? await getGraphDescriptor(board, context)
      : graph
        ? graph
        : await loadGraphFromPath(source, context);

    if (!runnableBoard) {
      throw new Error("Must provide valid board to include");
    }

    return await invokeGraph({ graph: runnableBoard }, args, context);
  },
};

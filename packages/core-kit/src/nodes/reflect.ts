/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  NodeHandlerContext,
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@google-labs/breadboard";
import { SchemaBuilder } from "@google-labs/breadboard/kits";

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

export default {
  desribe: async () => {
    return {
      inputSchema: SchemaBuilder.empty(),
      outputSchema: new SchemaBuilder()
        .addProperties({
          graph: {
            title: "graph",
            description: "The graph descriptor of the current board.",
            type: "object",
          },
        })
        .setAdditionalProperties(false)
        .addRequired("graph")
        .build(),
    };
  },
  invoke: async (
    _inputs: InputValues,
    context: NodeHandlerContext
  ): Promise<OutputValues> => {
    const graph = context.board ? deepCopy(context.board) : {};
    return { graph };
  },
};

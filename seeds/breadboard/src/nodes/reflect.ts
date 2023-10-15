/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, InputValues, OutputValues } from "../types.js";
import type { NodeHandlerContext } from "../types.js";
import { SchemaBuilder } from "../schema.js";

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
    const graph = deepCopy(context.board);
    return { graph };
  },
};

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor, InputValues, OutputValues } from "../types.js";
import type { NodeHandlerContext } from "../types.js";
import { empty } from "../schema.js";
import { Schema } from "jsonschema";

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

export default {
  desribe: async () => {
    return {
      inputSchema: empty(),
      outputSchema: {
        type: "object",
        properties: {
          graph: {
            title: "graph",
            description: "The graph descriptor of the current board.",
            type: "object",
          },
        },
        additionalProperties: false,
        required: ["graph"],
      } as Schema,
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

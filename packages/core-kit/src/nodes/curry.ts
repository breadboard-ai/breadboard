/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  anyOf,
  defineNodeType,
  object,
  unsafeSchema,
} from "@breadboard-ai/build";
import { getGraphDescriptor, inspect } from "@google-labs/breadboard";

export default defineNodeType({
  name: "curry",
  metadata: {
    title: "Curry",
    description:
      "Takes a board and bakes in (curries) supplied arguments into it. Very useful when we want to invoke a board with the same arguments many times (like with `map`).",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-curry-component",
    },
  },
  inputs: {
    $board: {
      title: "Board",
      type: anyOf("string", object({}, "unknown")),
      behavior: ["board"],
      description:
        "The board to curry. Can be a BoardCapability, a graph or a URL",
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    board: {
      title: "Board",
      type: object({}, "unknown"),
      behavior: ["board"],
      description: "The curried board as a graph descriptor",
    },
  },
  describe: async ({ $board }, _args, context) => {
    if ($board === undefined || context?.base === undefined) {
      return { inputs: { "*": "unknown" } };
    }
    let descriptor;
    try {
      descriptor = await getGraphDescriptor($board, context);
    } catch {
      // This is a describer, so it must always return some valid value.
    }
    if (!descriptor || !descriptor.success) {
      return { inputs: { "*": "unknown" } };
    }
    const { inputSchema } = await inspect(descriptor.graph).describe();
    return {
      inputs: unsafeSchema({
        ...inputSchema,
        // All inputs from the curried board should be optional, because
        // currying only a partial set of inputs is expected.
        required: [],
      }),
    };
  },
  invoke: async ({ $board }, args, context) => {
    const loadResult = await getGraphDescriptor($board, context);
    if (!loadResult.success) {
      throw new Error(`Error currying graph: ${loadResult.error}`);
    }
    const graph = loadResult.subGraphId
      ? loadResult.graph.graphs?.[loadResult.subGraphId]
      : loadResult.graph;
    return { board: { ...graph, args } };
  },
});

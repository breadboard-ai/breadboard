/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, RunArguments } from "../types.js";
import { runGraph } from "./run-graph.js";

export const interruptibleRunGraph = async function* (
  graph: GraphDescriptor,
  args: RunArguments = {}
) {
  loop: for await (const result of runGraph(graph, args)) {
    const { type } = result;
    switch (type) {
      case "input": {
        // Interrupt.
        yield result;
        break loop;
      }
      case "output": {
        yield result;
      }
    }
  }
};

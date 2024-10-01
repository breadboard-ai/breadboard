/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StartLabel } from "@breadboard-ai/types";
import type { GraphDescriptor, TraversalResult } from "../types.js";
import { TraversalMachineIterator } from "./iterator.js";
import { GraphRepresentation } from "./representation.js";
import { MachineResult } from "./result.js";
import { MachineEdgeState } from "./state.js";

export class TraversalMachine implements AsyncIterable<TraversalResult> {
  graph: GraphRepresentation;
  previousResult?: TraversalResult;

  constructor(
    descriptor: GraphDescriptor,
    result?: TraversalResult,
    start?: StartLabel
  ) {
    this.graph = new GraphRepresentation(descriptor, start);
    this.previousResult = result;
  }

  [Symbol.asyncIterator](): AsyncIterator<TraversalResult> {
    return this.start();
  }

  start(): TraversalMachineIterator {
    if (this.previousResult)
      return new TraversalMachineIterator(this.graph, this.previousResult);

    const { entries } = this.graph;
    if (entries.length === 0) throw new Error("No entry node found in graph.");
    // Create fake edges to represent entry points.
    const opportunities = entries.map((entry) => ({
      from: "$entry",
      to: entry,
    }));
    const entryResult = new MachineResult(
      { id: "$empty", type: "$empty" },
      {},
      [],
      { from: "$entry", to: entries[0] },
      opportunities,
      [],
      new MachineEdgeState()
    );
    return new TraversalMachineIterator(this.graph, entryResult);
  }
}

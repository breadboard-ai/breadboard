/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Graph } from "./graph.js";
import { traverseGraph } from "@google-labs/graph-runner";
import type {
  GraphDescriptor,
  GraphTraversalContext,
  InputValues,
  LogData,
  NodeHandlers,
  OutputValues,
} from "@google-labs/graph-runner";

export class Runner {
  async run(graph: Graph, progress: (s: string) => void = console.log) {
    const context = new ImperativeRunnerContext(graph.getHandlers(), progress);
    await traverseGraph(context, graph);
  }
}

// TODO: Make this not a special case.
class ImperativeRunnerContext implements GraphTraversalContext {
  constructor(
    public handlers: NodeHandlers,
    private readonly progress: (s: string) => void = console.log
  ) {}

  async log(data: LogData) {
    this.progress(JSON.stringify(data));
  }

  async requestExternalInput(_inputs: InputValues): Promise<OutputValues> {
    throw new Error("Not implemented");
  }

  async provideExternalOutput(_inputs: InputValues): Promise<void> {
    throw new Error("Not implemented");
  }

  async requestSlotOutput(
    _slot: string,
    _args: InputValues
  ): Promise<OutputValues> {
    throw new Error("Requesting slot output is not implemented");
  }

  async getCurrentGraph(): Promise<GraphDescriptor> {
    throw new Error("Not implemented");
  }

  async setCurrentGraph(_graph: GraphDescriptor): Promise<void> {
    throw new Error("Not implemented");
  }
}

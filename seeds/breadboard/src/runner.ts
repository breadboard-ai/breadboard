/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Graph } from "./graph.js";
import { traverseGraph } from "./traversal.js";
import type {
  GraphTraversalContext,
  InputValues,
  NodeHandlers,
  OutputValues,
} from "./types.js";

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

  log(s: string) {
    this.progress(s);
  }

  async requestExternalInput(_inputs: InputValues): Promise<OutputValues> {
    throw new Error("Not implemented");
  }

  async provideExternalOutput(_inputs: InputValues): Promise<void> {
    throw new Error("Not implemented");
  }
}

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTraversalContext, traverseGraph } from "./traversal.js";
import {
  Graph,
  type InputValues,
  type NodeHandlers,
  type OutputValues,
} from "./graph.js";

export class Runner {
  async run(graph: Graph, progress: (s: string) => void = console.log) {
    const context = new ImperativeRunnerContext(graph.getHandlers(), progress);
    await traverseGraph(context, graph);
  }
}

// TODO: Make this not a special case.
class ImperativeRunnerContext extends BaseTraversalContext {
  constructor(
    handlers: NodeHandlers,
    private readonly progress: (s: string) => void = console.log
  ) {
    super(handlers);
  }

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

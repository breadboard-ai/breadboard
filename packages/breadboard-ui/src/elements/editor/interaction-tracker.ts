/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GraphNodePort } from "./graph-node-port.js";
import { type GraphNode } from "./graph-node.js";
import { type Graph } from "./graph.js";

export class InteractionTracker {
  static #instance: InteractionTracker;
  static instance() {
    if (!this.#instance) {
      this.#instance = new InteractionTracker();
    }

    return this.#instance;
  }

  private constructor() {
    // Constructor only callable by Singleton function.
  }

  public hoveredGraphNodePort: GraphNodePort | null = null;
  public hoveredGraphNode: GraphNode | null = null;
  public activeGraphNodePort: GraphNodePort | null = null;
  public activeGraphNode: GraphNode | null = null;
  public activeGraph: Graph | null = null;

  clear() {
    this.hoveredGraphNodePort = null;
    this.hoveredGraphNode = null;
    this.activeGraphNodePort = null;
    this.activeGraphNode = null;
    this.activeGraph = null;
  }
}

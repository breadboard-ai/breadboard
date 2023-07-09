/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Edge, NodeDescriptor } from "@google-labs/graph-runner";

import { IBreadboard } from "./types.js";

export class Breadboard implements IBreadboard {
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];

  async run() {
    // Do something.
  }

  addEdge(edge: Edge) {
    this.edges.push(edge);
  }

  addNode(node: NodeDescriptor): void {
    this.nodes.push(node);
  }

  on(eventName: string, handler: () => void) {
    // Do something.
  }
}

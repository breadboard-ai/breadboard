/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  NodeDescriptor,
} from "@google-labs/graph-runner";

export class Breadboard implements GraphDescriptor {
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];

  add(node: Node) {
    // Do something.
  }

  async run() {
    // Do something.
  }

  on(event: string, handler: () => void) {
    // Do something.
  }
}

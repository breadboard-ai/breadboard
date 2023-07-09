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

export interface IBreadboard extends GraphDescriptor {
  run(): Promise<void>;
  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  on(event: string, handler: () => void): void;
}

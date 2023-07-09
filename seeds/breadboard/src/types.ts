/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  InputValues,
  NodeDescriptor,
  NodeHandlers,
} from "@google-labs/graph-runner";

export interface IBreadboard extends GraphDescriptor, EventTarget {
  run(): Promise<void>;
  addInputs(inputs: InputValues): void;
  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  addLibrary(library: ILibrary): void;
  on(event: string, handler: () => void): void;
}

export interface ILibrary {
  handlers: NodeHandlers;
}

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

export interface Breadboard extends GraphDescriptor, EventTarget {
  addInputs(inputs: InputValues): void;
  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  addLibrary(library: ILibrary): void;
}

export interface ILibrary {
  handlers: NodeHandlers;
}

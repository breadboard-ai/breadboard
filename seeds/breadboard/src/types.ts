/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  InputValues,
  NodeConfiguration,
  NodeDescriptor,
  NodeHandlers,
  NodeTypeIdentifier,
} from "@google-labs/graph-runner";

export interface Kit {
  handlers: NodeHandlers;
}

export type NodeFactory = (
  type: NodeTypeIdentifier,
  configuration?: NodeConfiguration,
  id?: string
) => BreadboardNode;

export interface KitConstructor<T extends Kit> {
  new (nodeFactory: NodeFactory): T;
}

export interface Breadboard extends GraphDescriptor, EventTarget {
  addInputs(inputs: InputValues): void;
  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  addKit<T extends Kit>(ctr: KitConstructor<T>): T;
}

export interface BreadboardNode extends NodeDescriptor {
  wire(spec: string, to: BreadboardNode): BreadboardNode;
}

export type OptionalIdConfiguration = { $id?: string } & NodeConfiguration;

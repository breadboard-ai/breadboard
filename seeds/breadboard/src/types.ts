/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  InputValues,
  KitDescriptor,
  NodeConfiguration,
  NodeDescriptor,
  NodeHandlers,
  NodeTypeIdentifier,
  OutputValues,
} from "@google-labs/graph-runner";

export interface Kit extends KitDescriptor {
  get handlers(): NodeHandlers;
}

export type BreadboardSlotSpec = Record<string, GraphDescriptor>;

export interface BreadbordRunResult {
  /**
   * Returns `true` if the board is waiting for
   * input values. Returns `false` if the board is providing outputs.
   */
  get seeksInputs(): boolean;
  /**
   * Any arguments that were passed to the `input` node that triggered this
   * stage.
   * Usually contains `message` property, which is a friendly message
   * to the user about what input is expected.
   * This property is only available when `seeksInputs` is `true`.
   */
  get inputArguments(): InputValues;
  /**
   * The input values the board is waiting for.
   * Set this property to provide input values.
   * This property is only available when `seeksInputs` is `true`.
   */
  set inputs(input: InputValues);
  /**
   * the output values the board is providing.
   * This property is only available when `seeksInputs` is `false`.
   */
  get outputs(): OutputValues;
}

export type NodeFactory = (
  type: NodeTypeIdentifier,
  configuration?: NodeConfiguration,
  id?: string
) => BreadboardNode;

export interface KitConstructor<T extends Kit> {
  new (nodeFactory: NodeFactory): T;
}

export interface ProbeDetails {
  descriptor: NodeDescriptor;
  inputs: InputValues;
  missingInputs?: string[];
  outputs?: OutputValues;
  nesting?: number;
  sources?: string[];
  safetyLabel?: string;
}

export type ProbeEvent = CustomEvent<ProbeDetails>;

export interface Breadboard extends GraphDescriptor {
  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  addKit<T extends Kit>(ctr: KitConstructor<T>): T;
}

export interface BreadboardNode extends NodeDescriptor {
  wire(spec: string, to: BreadboardNode): BreadboardNode;
}

export type OptionalIdConfiguration = { $id?: string } & NodeConfiguration;

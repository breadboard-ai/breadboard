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

export interface NodeFactory {
  create<Inputs, Outputs>(
    type: NodeTypeIdentifier,
    configuration?: NodeConfiguration,
    id?: string
  ): BreadboardNode<Inputs, Outputs>;
}

export interface KitConstructor<T extends Kit> {
  new (nodeFactory: NodeFactory): T;
}

/**
 * Validator metadata for a node.
 * Used e.g. in ProbeDetails.
 */
export interface BreadboardValidatorMetadata {
  description: string;
}

/**
 * A validator for a breadboard.
 * For example to check integrity using information flow control.
 */
export interface BreadboardValidator {
  /**
   * Add a graph and validate it.
   *
   * @param graph The graph to validate.
   * @throws Error if the graph is invalid.
   */
  addGraph(graph: GraphDescriptor): void;

  /**
   * Gets the validation metadata for a node.
   *
   * @param node Node to get metadata for.
   */
  getValidatorMetadata(node: NodeDescriptor): BreadboardValidatorMetadata;

  /**
   * Generate a validator for a subgraph, replacing a given node. Call
   * .addGraph() on the returned validator to add and validate the subgraph.
   *
   * @param node The node to replace.
   * @returns A validator for the subgraph.
   */
  getSubgraphValidator(node: NodeDescriptor): BreadboardValidator;
}

/**
 * Details of the `ProbeEvent` event.
 */
export interface ProbeDetails {
  /**
   * Internal representation of the node that is placed on the board.
   */
  descriptor: NodeDescriptor;
  /**
   * The input values the node was passed.
   */
  inputs: InputValues;
  /**
   * Any missing inputs that the node was expecting.
   * This property is only populated for `skip` event.
   */
  missingInputs?: string[];
  /**
   * The output values the node provided.
   */
  outputs?: OutputValues;
  /**
   * The nesting level of the node.
   * When a board contains included or slotted boards, this level will
   * increment for each level of nesting.
   */
  nesting?: number;
  sources?: string[];
  validatorMetadata?: BreadboardValidatorMetadata[];
}

/**
 * A probe event that is distpached during board run.
 *
 * See [Chapter 7: Probes](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-7-probes) for more information.
 */
export type ProbeEvent = CustomEvent<ProbeDetails>;

export interface Breadboard extends GraphDescriptor {
  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  addKit<T extends Kit>(ctr: KitConstructor<T>): T;
}

export type WireOutSpec<From, To> =
  | `${string & keyof From}->${string & keyof To}`
  | `${string & keyof From}->`
  | `->${string & keyof From}`
  | `${string & keyof From}`
  | `${string & keyof From}->${string & keyof To}?`
  | `${string & keyof From}->?`
  | `->${string & keyof From}?`
  | `${string & keyof From}?`
  | `${string & keyof From}->${string & keyof To}.`
  | `${string & keyof From}->.`
  | `->${string & keyof From}.`
  | `${string & keyof From}.`;

export type WireInSpec<From, To> =
  | `${string & keyof From}<-${string & keyof To}`
  | `${string & keyof From}<-`
  | `<-${string & keyof From}`
  | `${string & keyof From}<-${string & keyof To}?`
  | `${string & keyof From}<-?`
  | `${string & keyof From}?`
  | `${string & keyof From}<-${string & keyof To}.`
  | `${string & keyof From}<-.`
  | `<-${string & keyof From}.`;

export type WireSpec<FromIn, FromOut, ToIn, ToOut> =
  | WireOutSpec<FromOut, ToIn>
  | WireInSpec<ToOut, FromIn>;

export interface BreadboardNode<Inputs, Outputs> {
  /**
   * Wires the current node to another node.
   *
   * Use this method to wire nodes together.
   *
   * @param spec - the wiring spec. See the [wiring spec](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/wires.md) for more details.
   * @param to - the node to wire this node with.
   * @returns - the current node, to enable chaining.
   */
  wire<ToInputs, ToOutputs>(
    spec: string,
    to: BreadboardNode<ToInputs, ToOutputs>
  ): BreadboardNode<Inputs, Outputs>;
}

/**
 * A node configuration that can optionally have an `$id` property.
 *
 * The `$id` property is used to identify the node in the board and is not
 * passed to the node itself.
 */
export type OptionalIdConfiguration = { $id?: string } & NodeConfiguration;

export type ReflectNodeOutputs = {
  graph: GraphDescriptor;
};

export type IncludeNodeInputs = {
  path?: string;
  $ref?: string;
  slotted?: BreadboardSlotSpec;
  parent: NodeDescriptor;
  args: InputValues;
};

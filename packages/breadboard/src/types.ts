/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  GraphDescriptor,
  InputValues,
  Kit,
  NodeDescriptor,
  NodeHandlers,
  NodeIdentifier,
  NodeTypeIdentifier,
  NodeValue,
  OutputValues,
} from "@breadboard-ai/types";

export type {
  Capability,
  CommentNode,
  Edge,
  GraphDescriptor,
  GraphIdentifier,
  GraphInlineMetadata,
  InputIdentifier,
  InputValues,
  KitDescriptor,
  KitReference,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  NodeTypeIdentifier,
  NodeValue,
  OutputIdentifier,
  OutputValues,
  SubGraphs,
} from "@breadboard-ai/types";

export type { InputResponse, OutputResponse } from "@breadboard-ai/types";
export type * from "@breadboard-ai/types/node-handler.js";
export type * from "@breadboard-ai/types/schema.js";

export interface NodeFactory {
  create<Inputs, Outputs>(
    kit: Kit | undefined,
    type: NodeTypeIdentifier,
    configuration?: NodeConfigurationConstructor,
    id?: string
  ): BreadboardNode<Inputs, Outputs>;
  getConfigWithLambda(config: ConfigOrGraph): OptionalIdConfiguration;
}

export interface KitConstructor<T extends Kit> {
  new (nodeFactory: NodeFactory): T;
}

export type NodeSugar<In, Out> = (
  config?: ConfigOrGraph
) => BreadboardNode<In, Out>;

export type GenericKit<T extends NodeHandlers> = Kit & {
  [key in keyof T]: NodeSugar<unknown, unknown>;
};

export interface Breadboard extends GraphDescriptor {
  input<In = InputValues, Out = OutputValues>(
    config?: OptionalIdConfiguration
  ): BreadboardNode<In, Out>;
  output<In = InputValues, Out = OutputValues>(
    config?: OptionalIdConfiguration
  ): BreadboardNode<In, Out>;

  addEdge(edge: Edge): void;
  addNode(node: NodeDescriptor): void;
  addKit<T extends Kit>(ctr: KitConstructor<T>): T;
  currentBoardToAddTo(): Breadboard;
  addEdgeAcrossBoards(edge: Edge, from: Breadboard, to: Breadboard): void;
}

export type GraphDescriptorBoardCapability = {
  kind: "board";
  board: GraphDescriptor;
  /**
   * A string that could be used to render the user-friendly view of the
   * capability.
   */
  preview?: string;
};

export type ResolvedURLBoardCapability = {
  kind: "board";
  /**
   * Resolved path to the board. This field is populated at run-time as a
   * result of resolving the `path` field.
   */
  url: string;
  /**
   * A string that could be used to render the user-friendly view of the
   * capability.
   */
  preview?: string;
};

export type UnresolvedPathBoardCapability = {
  kind: "board";
  /**
   * Unresolved path to the board. Use this field to specify the path at
   * compose-time that needs to be resolved at run-time.
   * The path will be resolved as the inputs are received by the board,
   * relative to the invoking board.
   */
  path: string;
  /**
   * A string that could be used to render the user-friendly view of the
   * capability.
   */
  preview?: string;
};

export type BreadboardCapability =
  | GraphDescriptorBoardCapability
  | ResolvedURLBoardCapability
  | UnresolvedPathBoardCapability;

export interface BreadboardNode<Inputs, Outputs> {
  /**
   * Wires the current node to another node.
   *
   * Use this method to wire nodes together.
   *
   * @param spec - the wiring spec. See the [wiring spec](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/wires.md) for more details.
   * @param to - the node to wire this node with.
   * @returns - the current node, to enable chaining.
   */
  wire<ToInputs, ToOutputs>(
    // spec: WireSpec<Inputs, Outputs, ToInputs, ToOutputs>,
    spec: string,
    to: BreadboardNode<ToInputs, ToOutputs>
  ): BreadboardNode<Inputs, Outputs>;

  readonly id: NodeIdentifier;
}

/**
 * A node configuration that can optionally have an `$id` property.
 *
 * The `$id` property is used to identify the node in the board and is not
 * passed to the node itself.
 */
export type OptionalIdConfiguration = {
  $id?: string;
} & NodeConfigurationConstructor;

/**
 * A node configuration that optionally has nodes as values. The Node()
 * constructor will remove those and turn them into wires into the node instead.
 */
export type NodeConfigurationConstructor = Record<
  string,
  NodeValue | BreadboardNode<InputValues, OutputValues>
>; // extends NodeConfiguration

/**
 * Syntactic sugar for node factories that accept lambdas. This allows passing
 * either
 *  - A JS function that is a lambda function defining the board
 *  - A board capability, i.e. the result of calling lambda()
 *  - A board node, which should be a node with a `board` output
 * or
 *  - A regular config, with a `board` property with any of the above.
 *
 * use `getConfigWithLambda()` to turn this into a regular config.
 */
export type ConfigOrGraph =
  | OptionalIdConfiguration
  | BreadboardCapability
  | GraphDescriptor;

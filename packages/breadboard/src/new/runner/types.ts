/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeDescriptor,
  GraphDescriptor,
  GraphMetadata,
  NodeDescriberFunction,
  NodeDescriberResult,
  NodeValue as OriginalNodeValue,
  Schema,
} from "../../types.js";

// TODO:BASE: Same as before, but I added NodeFactory as base type, which is a
// way to encapsulate boards, including lambdas (instead of BoardCapability).
// Can keep it a capability, but this feels quite fundamental.

export type NodeValue = OriginalNodeValue | PromiseLike<NodeValue> | unknown;
export type NodeTypeIdentifier = string;

export type InputValues = { [key: string]: NodeValue };

export type OutputValues = { [key: string]: NodeValue };
export type OutputValue<T> = Partial<{ [key: string]: T }>;

export type NodeHandlerFunction<
  I extends InputValues,
  O extends OutputValues
> = (
  inputs: PromiseLike<I> & I,
  node: AbstractNode<I, O>
) => O | PromiseLike<O>;

export type NodeHandler<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> =
  | {
      invoke: NodeHandlerFunction<I, O>;
      describe?: NodeDescriberFunction;
    }
  | NodeHandlerFunction<I, O>;

export type NodeHandlers = Record<
  NodeTypeIdentifier,
  NodeHandler<InputValues, OutputValues>
>;

export interface Serializeable {
  serialize(
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor> | GraphDescriptor;
}

export type KeyMap = { [key: string]: string };

// TODO: Add optional.
export interface EdgeInterface<
  FromI extends InputValues = InputValues,
  FromO extends OutputValues = OutputValues,
  ToI extends InputValues = InputValues,
  ToO extends OutputValues = OutputValues
> {
  from: AbstractNode<FromI, FromO>;
  to: AbstractNode<ToI, ToO>;
  out: string;
  in: string;
  constant?: boolean;
}

export type OptionalIdConfiguration = { $id?: string };

export abstract class AbstractNode<
  I extends InputValues = InputValues,
  O extends OutputValues = OutputValues
> implements Serializeable
{
  abstract id: string;
  abstract type: string;
  abstract outgoing: EdgeInterface[];
  abstract incoming: EdgeInterface[];
  abstract configuration: Partial<I>;

  abstract receiveInputs(edge: EdgeInterface, inputs: InputValues): string[];
  abstract missingInputs(): string[] | false;

  abstract getInputs(): I;

  abstract invoke(dynamicScope?: ScopeInterface): Promise<O>;
  abstract describe(
    scope?: ScopeInterface,
    inputs?: InputValues,
    inputSchema?: Schema,
    outputSchema?: Schema
  ): Promise<NodeDescriberResult | undefined>;

  abstract serialize(metadata?: GraphMetadata): Promise<GraphDescriptor>;

  abstract serializeNode(): Promise<[NodeDescriptor, GraphDescriptor?]>;
}

export interface OutputDistribution {
  nodes: {
    node: AbstractNode;
    received: string[];
    missing: string[] | false;
  }[];
  unused: string[];
}

export interface InvokeCallbacks {
  before?: (
    node: AbstractNode,
    inputs: InputValues
  ) => undefined | Promise<OutputValues | undefined>;
  after?: (
    node: AbstractNode,
    inputs: InputValues,
    outputs: OutputValues,
    distribution: OutputDistribution
  ) => void | Promise<void>;
  done?: () => void | Promise<void>;
}

export interface ScopeConfig {
  lexicalScope?: ScopeInterface;
  dynamicScope?: ScopeInterface;
}

export interface ScopeInterface {
  addHandlers(handlers: NodeHandlers): void;

  /**
   * Finds handler by name
   *
   * Scans up the parent chain if not found in this scope, looking in calling
   * scopes before the declaration context scopes.
   *
   * That is, if a graph is invoked with a specific set of kits, then those kits
   * have precedence over kits declared when building the graphs. And kits
   * declared by invoking graphs downstream have precedence over those declared
   * upstream.
   *
   * @param name Name of the handler to retrieve
   * @returns Handler or undefined
   */
  getHandler<
    I extends InputValues = InputValues,
    O extends OutputValues = OutputValues
  >(
    name: string
  ): NodeHandler<I, O> | undefined;

  serialize(
    node: AbstractNode,
    metadata?: GraphMetadata
  ): Promise<GraphDescriptor>;
}

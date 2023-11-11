/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InputValues, NodeDescriptor, OutputValues } from "../types.js";

/**
 * Valid request names: "load", "run", "proxy".
 */
export type RequestName = "load" | "run" | "proxy";

export type LoadRequest = {
  /**
   * The url of the board to load.
   */
  url: string;
  /**
   * The list of nodes to proxy.
   */
  proxyNodes: string[];
};

export type LoadResponse = {
  /**
   * The title of the graph.
   */
  title?: string;
  /**
   * The description of the graph.
   */
  description?: string;
  /**
   * Version of the graph.
   * [semver](https://semver.org/) format is encouraged.
   */
  version?: string;
  /**
   * The Mermaid diagram of the graph.
   */
  diagram?: string;
  /**
   * The url of the graph.
   */
  url?: string;
};

/**
 * A run request is an empty object.
 * It basically just pokes the server to start running.
 */
export type RunRequest = Record<string, never>;

/**
 * Sent by a server to supply outputs.
 */
export type OutputResponse = {
  /**
   * The description of the node that is providing output.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  /**
   * The output values that the node is providing.
   * @see [OutputValues]
   */
  outputs: OutputValues;
};

/**
 * Sent by a server just before a node is about to run.
 */
export type BeforehandlerResponse = {
  /**
   * The description of the node that is about to run.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
};

/**
 * Sent by a server to request input.
 * Can only be the last message in the response stream.
 */
export type InputPromiseResponse = {
  /**
   * The description of the node that is requesting input.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  /**
   * The input arguments that were given to the node that is requesting input.
   * These arguments typically contain the schema of the inputs that are
   * expected.
   * @see [InputValues]
   */
  inputArguments: InputValues;
};

/**
 * Sent by the client to provide inputs, requested by the server.
 */
export type InputResolveRequest = {
  inputs: InputValues;
};

/**
 * Sent by the server to request to proxy a node.
 * Can only be the last message in the response stream.
 */
export type ProxyPromiseResponse = {
  /**
   * The description of the node to be proxied.
   * @see [NodeDescriptor]
   */
  node: NodeDescriptor;
  /**
   * The input values that the board is providing to the node.
   * @see [InputValues]
   */
  inputs: InputValues;
};

/**
 * Sent by the client to provide outputs of the proxied node.
 */
export type ProxyResolveRequest = {
  /**
   * The output values that the host is providing to the board in lieu of
   * the proxied node.
   * @see [OutputValues]
   */
  outputs: OutputValues;
};

/**
 * Indicates that the board is done running.
 * Can only be the last message in the response stream.
 */
export type EndResponse = Record<string, never>;

/**
 * Sent by the server when an error occurs.
 * Error response also indicates that the board is done running.
 * Can only be the last message in the response stream.
 */
export type ErrorResponse = {
  /**
   * The error message.
   */
  error: string;
};

export type ProxyRequest = ProxyPromiseResponse;
export type ProxyResponse = ProxyResolveRequest;

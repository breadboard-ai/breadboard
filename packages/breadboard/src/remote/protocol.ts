/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PatchedReadableStream } from "../stream.js";
import {
  ErrorResponse,
  GraphEndProbeMessage,
  GraphStartProbeMessage,
  InputResponse,
  InputValues,
  NodeDescriptor,
  NodeEndProbeMessage,
  NodeStartProbeMessage,
  OutputResponse,
  OutputValues,
  RunState,
  SkipProbeMessage,
} from "../types.js";

/**
 * Sent by the client to request loading a board. This is an optional request
 * that may not be implemented in some environments (for example, a cloud
 * function that can only run one board).
 */
export type LoadRequest = {
  /**
   * The url of the board to load.
   */
  url: string;
};

/**
 * Sent by the server to indicate that the board is loaded.
 */
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
  /**
   * Information about the nodes in the graph.
   */
  nodes?: NodeDescriptor[];
};

type GenericResult = { type: string; data: unknown };

type RemoteMessage<T extends GenericResult> = [T["type"], T["data"], RunState?];

/**
 * A run request is an empty object.
 * It basically just pokes the server to start running.
 */
export type RunRequest = Record<string, never>;
export type RunRequestMessage = ["run", RunRequest, RunState?];
export type OutputResponseMessage = ["output", OutputResponse];
export type InputResponseMessage = ["input", InputResponse, RunState];

/**
 * Sent by the client to provide inputs, requested by the server.
 */
export type InputResolveRequest = { inputs: InputValues };
export type InputResolveRequestMessage = [
  "input",
  InputResolveRequest,
  RunState
];

/**
 * Indicates that the board is done running.
 * Can only be the last message in the response stream.
 */
export type End = Record<string, never>;
export type EndResponseMessage = ["end", End];
export type EndRequestMessage = ["end", End];

export type ErrorResponseMessage = ["error", ErrorResponse];

/**
 * Sent by the client to request to proxy a node.
 */
export type ProxyRequest = {
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
 * Sent by the server to respond to respond with the proxy results.
 */
export type ProxyResponse = {
  /**
   * The output values that the host is providing to the board in lieu of
   * the proxied node.
   * @see [OutputValues]
   */
  outputs: OutputValues;
};

export type ProxyRequestMessage = ["proxy", ProxyRequest];
export type ProxyResponseMessage = ["proxy", ProxyResponse];

export type ProxyChunkResponse = { chunk: unknown };
export type ProxyChunkResponseMessage = ["chunk", ProxyChunkResponse];

export type AnyProxyRequestMessage = ProxyRequestMessage | EndRequestMessage;
export type AnyProxyResponseMessage =
  | ProxyResponseMessage
  | ErrorResponseMessage
  | ProxyChunkResponseMessage
  | EndResponseMessage;

export type AnyRunRequestMessage =
  | RunRequestMessage
  | InputResolveRequestMessage;

export type AnyProbeMessage =
  | RemoteMessage<NodeStartProbeMessage>
  | RemoteMessage<NodeEndProbeMessage>
  | RemoteMessage<GraphStartProbeMessage>
  | RemoteMessage<GraphEndProbeMessage>
  | RemoteMessage<SkipProbeMessage>;

export type AnyRunResponseMessage =
  | OutputResponseMessage
  | InputResponseMessage
  | EndResponseMessage
  | ErrorResponseMessage
  | AnyProbeMessage;

export interface ClientBidirectionalStream<Request, Response> {
  writableRequests: WritableStream<Request>;
  readableResponses: PatchedReadableStream<Response>;
}

export interface ServerBidirectionalStream<Request, Response> {
  readableRequests: PatchedReadableStream<Request>;
  writableResponses: WritableStream<Response>;
}

export interface ServerTransport<Request, Response> {
  createServerStream(): ServerBidirectionalStream<Request, Response>;
}

export interface ClientTransport<Request, Response> {
  createClientStream(): ClientBidirectionalStream<Request, Response>;
}

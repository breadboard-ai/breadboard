/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataStore, StateStore } from "../data/types.js";
import { RunConfig, RunDiagnosticsLevel } from "../harness/types.js";
import { GraphLoader } from "../loader/types.js";
import type { RunState } from "../run/types.js";
import { PatchedReadableStream } from "../stream.js";
import type {
  EdgeProbeMessage,
  GraphDescriptor,
  GraphEndProbeMessage,
  GraphStartProbeMessage,
  InputValues,
  NodeDescriptor,
  NodeEndProbeMessage,
  NodeStartProbeMessage,
  OutputValues,
  SkipProbeMessage,
  TraversalResult,
} from "@breadboard-ai/types";
import { OutputResponse, Kit, ErrorResponse, InputResponse } from "../types.js";
import { MutableGraphStore } from "../inspector/types.js";

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

export type AsRemoteMessage<T extends GenericResult> = [
  T["type"],
  T["data"],
  next?: string,
];

/**
 * A run request is an empty object.
 * It basically just pokes the server to start running.
 */
export type RunRequest = Record<string, never>;
export type RunRequestMessage = ["run", RunRequest, RunState?];
export type OutputRemoteMessage = ["output", OutputResponse];
export type InputRemoteMessage = ["input", InputResponse, next?: string];

/**
 * Sent by the client to provide inputs, requested by the server.
 */
export type InputResolveRequest = { inputs: InputValues };
export type InputResolveRequestMessage = [
  "input",
  InputResolveRequest,
  next?: string,
];

export type LastNode = {
  node: NodeDescriptor;
  missing: string[];
};

/**
 * Indicates that the board is done running.
 * Can only be the last message in the response stream.
 */
export type End = {
  timestamp: number;
  last?: LastNode;
};
export type EndRemoteMessage = ["end", End];
export type EndRequestMessage = ["end", End];

export type ErrorRemoteMessage = ["error", ErrorResponse];

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
  | ErrorRemoteMessage
  | ProxyChunkResponseMessage
  | EndRemoteMessage;

export type AnyRunRequestMessage =
  | RunRequestMessage
  | InputResolveRequestMessage;

export type NodeStartRemoteMessage = AsRemoteMessage<NodeStartProbeMessage>;
export type NodeEndRemoteMessage = AsRemoteMessage<NodeEndProbeMessage>;
export type GraphStartRemoteMessage = AsRemoteMessage<GraphStartProbeMessage>;
export type GraphEndRemoteMessage = AsRemoteMessage<GraphEndProbeMessage>;
export type SkipRemoteMessage = AsRemoteMessage<SkipProbeMessage>;
export type EdgeRemoteMessage = AsRemoteMessage<EdgeProbeMessage>;

export type DiagnosticsRemoteMessage =
  | NodeStartRemoteMessage
  | NodeEndRemoteMessage
  | GraphStartRemoteMessage
  | GraphEndRemoteMessage
  | SkipRemoteMessage
  | EdgeRemoteMessage;

export type RemoteMessage =
  | OutputRemoteMessage
  | InputRemoteMessage
  | EndRemoteMessage
  | ErrorRemoteMessage
  | DiagnosticsRemoteMessage;

export type RemoteMessageWriter = WritableStreamDefaultWriter<RemoteMessage>;
export type RemoteMessageWritableStream = WritableStream<RemoteMessage>;

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

export type RunClientTransport = ClientTransport<
  AnyRunRequestMessage,
  RemoteMessage
>;

type ReplyFunction = {
  reply: (chunk: AnyRunRequestMessage[1]) => Promise<void>;
};

type ClientRunResultFromMessage<ResponseMessage> = ResponseMessage extends [
  string,
  object,
  string?,
]
  ? {
      type: ResponseMessage[0];
      data: ResponseMessage[1];
      result?: TraversalResult;
    } & ReplyFunction
  : never;

export type AnyClientRunResult = ClientRunResultFromMessage<RemoteMessage>;

export type AnyProbeClientRunResult =
  ClientRunResultFromMessage<DiagnosticsRemoteMessage>;

export type ClientRunResult<T> = T & ReplyFunction;

export type ServerRunRequest = {
  inputs?: InputValues;
  next?: string;
  diagnostics?: RunDiagnosticsLevel;
};

export type ServerRunConfig = {
  graph?: GraphDescriptor;
  url: string;
  kits: Kit[];
  writer: RemoteMessageWriter;
  loader: GraphLoader;
  graphStore: MutableGraphStore;
  dataStore: DataStore;
  stateStore: StateStore;
  inputs?: InputValues;
  diagnostics?: RunDiagnosticsLevel;
};

export type RemoteRunConfig = Omit<RunConfig, "kits">;

export type RemoteRunRequestBody = {
  $key: string;
  $next?: string;
  $diagnostics?: boolean;
} & InputValues;
